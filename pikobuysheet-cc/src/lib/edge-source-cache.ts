import type {SharedSourceCache,SourceEntry} from './source-cache';

// Bounded, temporary public catalog snapshots. Locale requests share source URLs.
// Two fixed resources plus 11 reserved category and 77 replaceable slots: no persistent catalog,
// user searches, cookies, SKU/QC responses, or public proxy route.
export const categorySources=['/shoes/','/hoodies-sweaters/','/t-shirts/','/jackets/','/pants-shorts/','/headwear/','/accessories/','/ShortSets/','/electronics/','/other-stuff/','/jersey/'];
// Keep the existing keys for root categories, but stop product traffic from
// replacing them. These are their original, distinct v2 hash slots.
const categorySlots=[27,31,1,62,33,28,21,58,38,52,87];
const replaceableSlots=Array.from({length:88},(_,i)=>i).filter(i=>!categorySlots.includes(i));
export function sourceCacheKey(source:string){
  const url=new URL(source);
  if(url.origin!=='https://findspreadsheet.com')return;
  const resource=url.pathname+url.search;
  const base='https://pikobuysheet.cc/__internal-source-cache/v2/';
  if(resource==='/AllProducts/'||resource==='/template/cnbuynew/pc/static/js/script.js?v=4.7.9')return {key:base+encodeURIComponent(resource),resource,bucket:false};
  if(url.search)return;
  const category='(?:AllProducts|shoes|hoodies-sweaters|t-shirts|jackets|pants-shorts|headwear|accessories|ShortSets|electronics|other-stuff|jersey)';
  if(!new RegExp('^/'+category+'/(?:list_\\d+_\\d+/|[a-zA-Z0-9-]+-\\d+\\.html)?$').test(resource))return;
  let hash=2166136261;
  for(const char of resource)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  const categoryIndex=categorySources.indexOf(resource);
  return {key:base+'slot-'+(categoryIndex>=0?categorySlots[categoryIndex]:replaceableSlots[hash%replaceableSlots.length]),resource,bucket:true};
}
export const edgeSourceCache:SharedSourceCache={
  async retryAt(scope='origin'){
    if(typeof caches==='undefined')return;
    const cache=await caches.open('pikobuysheet-source-v1');
    const response=await cache.match('https://pikobuysheet.cc/__internal-source-cache/v1/retry-after'+(scope==='qc'?'-qc':''));
    if(!response)return;
    const until=Number(await response.text());
    return Number.isFinite(until)?until:undefined;
  },
  async backoff(until,scope='origin'){
    if(typeof caches==='undefined'||until<=Date.now())return;
    const cache=await caches.open('pikobuysheet-source-v1');
    await cache.put('https://pikobuysheet.cc/__internal-source-cache/v1/retry-after'+(scope==='qc'?'-qc':''),new Response(String(until),{headers:{
      'Content-Type':'text/plain',
      'Cache-Control':`public, max-age=${Math.ceil((until-Date.now())/1000)}`
    }}));
  },
  async get(source){
    const item=sourceCacheKey(source);
    if(!item||typeof caches==='undefined')return;
    const cache=await caches.open('pikobuysheet-source-v1');
    const response=await cache.match(item.key);
    if(!response)return;
    // A slot collision is a cache miss, never another product's response.
    if(item.bucket&&response.headers.get('X-Source-Resource')!==item.resource)return;
    const at=Number(response.headers.get('X-Source-Fetched-At'));
    if(!Number.isFinite(at)||at<=0)return;
    return {at,value:await response.text()};
  },
  async set(source,entry,retentionMs){
    const item=sourceCacheKey(source);
    if(!item||typeof caches==='undefined')return;
    // Prevent a challenge/login page with status 200 from becoming the shared catalog.
    if(!item.resource.includes('/static/')){
      const expected=item.resource.endsWith('.html')?'product-detail':'product-card';
      if(!new RegExp('class=["\'][^"\']*\\b'+expected+'\\b').test(entry.value))return;
    }
    const cache=await caches.open('pikobuysheet-source-v1');
    await cache.put(item.key,new Response(entry.value,{headers:{
      'Content-Type':'text/plain; charset=utf-8',
      'Cache-Control':`public, max-age=${Math.ceil(retentionMs/1000)}`,
      'X-Source-Fetched-At':String(entry.at),
      'X-Source-Resource':item.resource
    }}));
  }
};

// KV holds the same bounded public projections, with an absolute expiry.
// Unlike Cache API, a successful snapshot is available to a cold region too.
// It is not a catalog database: no searches, API data, cookies or images; at
// most 90 replaceable responses plus two short-lived cooldown markers.
export type SourceKV={
  get(key:string,options:{type:'json',cacheTtl:number}):Promise<any>;
  put(key:string,value:string,options:{expiration:number}):Promise<void>;
};
export function createSharedSourceCache(kv?:SourceKV,local:SharedSourceCache=edgeSourceCache,now=Date.now):SharedSourceCache {
  if(!kv)return local;
  const cooldownKey=(scope='origin')=>'cooldown:v1:'+scope;
  const key=(source:string)=>sourceCacheKey(source);
  const valid=(value:any,resource:string):value is SourceEntry&{resource:string,expiresAt:number,needsExpiry?:boolean}=>
    value?.resource===resource&&typeof value.value==='string'&&Number.isFinite(value.at)&&value.at>0&&value.at<=now()&&
    Number.isFinite(value.expiresAt)&&value.expiresAt>now()&&value.expiresAt<=value.at+86400000;
  return {
    async get(source){
      const item=key(source);if(!item)return;
      let hit:SourceEntry|undefined;
      try{hit=await local.get(source);}catch{}
      // A fresh local projection avoids unnecessary global storage reads.
      if(hit&&now()-hit.at<180000)return hit;
      try{
        const saved=await kv.get(item.key,{type:'json',cacheTtl:60});
        if(valid(saved,item.resource)&&(!hit||saved.at>hit.at)){
          hit={at:saved.at,value:saved.value};
          // The dashboard's one-time warmup form has no TTL field. Adopt its
          // original expiry in KV on first read, without making the data newer.
          if(saved.needsExpiry&&saved.expiresAt-now()>=60000){
            try{await kv.put(item.key,JSON.stringify({...saved,needsExpiry:false}),{expiration:Math.ceil(saved.expiresAt/1000)});}catch{}
          }
          try{await local.set(source,hit,saved.expiresAt-now());}catch{}
        }
      }catch{/* A cache outage must not discard a local successful response. */}
      return hit;
    },
    async set(source,entry,retentionMs){
      const item=key(source);if(!item)return;
      const expiresAt=entry.at+Math.min(retentionMs,86400000);
      if(!Number.isFinite(entry.at)||entry.at<=0||entry.at>now()||expiresAt<=now())return;
      // Validate again at the storage boundary, including manual warmup inputs.
      if(!item.resource.includes('/static/')){
        const expected=item.resource.endsWith('.html')?'product-detail':'product-card';
        if(!new RegExp('class=["\'][^"\']*\\b'+expected+'\\b').test(entry.value))return;
      }
      try{await local.set(source,entry,expiresAt-now());}catch{}
      if(expiresAt-now()<60000)return;
      await kv.put(item.key,JSON.stringify({...entry,resource:item.resource,expiresAt}),{expiration:Math.ceil(expiresAt/1000)});
    },
    async retryAt(scope='origin'){
      let until=0;
      try{until=await local.retryAt?.(scope)||0;}catch{}
      try{const saved=await kv.get(cooldownKey(scope),{type:'json',cacheTtl:60});if(Number.isFinite(saved?.until))until=Math.max(until,saved.until);}catch{}
      return until;
    },
    async backoff(until,scope='origin'){
      try{await local.backoff?.(until,scope);}catch{}
      if(until>now())await kv.put(cooldownKey(scope),JSON.stringify({until}),{expiration:Math.ceil(Math.max(until,now()+60000)/1000)});
    }
  };
}
