import type {SharedSourceCache} from './source-cache';

// Two anonymous public resources, shared across isolates in the same edge
// location. No product database, user cookies, SKU/QC data, or public proxy route.
function cacheKey(source:string){
  const url=new URL(source);
  if(url.origin!=='https://findspreadsheet.com')return;
  const resource=url.pathname+url.search;
  if(resource!=='/AllProducts/'&&resource!=='/template/cnbuynew/pc/static/js/script.js?v=4.7.9')return;
  return 'https://pikobuysheet.cc/__internal-source-cache/v1/'+encodeURIComponent(resource);
}
export const edgeSourceCache:SharedSourceCache={
  async get(source){
    const key=cacheKey(source);
    if(!key||typeof caches==='undefined')return;
    const cache=await caches.open('pikobuysheet-source-v1');
    const response=await cache.match(key);
    if(!response)return;
    const at=Number(response.headers.get('X-Source-Fetched-At'));
    if(!Number.isFinite(at)||at<=0)return;
    return {at,value:await response.text()};
  },
  async set(source,entry,retentionMs){
    const key=cacheKey(source);
    if(!key||typeof caches==='undefined')return;
    // Prevent a challenge/login page with status 200 from becoming the shared catalog.
    if(new URL(source).pathname==='/AllProducts/'&&!/class=["'][^"']*\bproduct-card\b/.test(entry.value))return;
    const cache=await caches.open('pikobuysheet-source-v1');
    await cache.put(key,new Response(entry.value,{headers:{
      'Content-Type':'text/plain; charset=utf-8',
      'Cache-Control':`public, max-age=${Math.ceil(retentionMs/1000)}`,
      'X-Source-Fetched-At':String(entry.at)
    }}));
  }
};
