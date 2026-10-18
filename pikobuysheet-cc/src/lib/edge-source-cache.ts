import type {SharedSourceCache} from './source-cache';

// Bounded, temporary public catalog snapshots. Locale requests share source URLs.
// Two fixed resources plus 88 replaceable slots: no persistent catalog,
// user searches, cookies, SKU/QC responses, or public proxy route.
function cacheKey(source:string){
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
  return {key:base+'slot-'+(hash%88),resource,bucket:true};
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
    const item=cacheKey(source);
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
    const item=cacheKey(source);
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
