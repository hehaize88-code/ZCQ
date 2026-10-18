import {catalogFor,ORIGIN} from './catalog';
import {categorySources,createSharedSourceCache,type SourceKV} from './edge-source-cache';

// Refresh three root lists sequentially per ten-minute tick. Rotate the first
// attempt too, so an unavailable category cannot permanently starve the rest.
// No fan-out, origin retry loop, extra persisted data, or refreshed cache age.
export async function refreshCatalogRoots(kv:SourceKV,scheduledTime=Date.now()){
 const paths=['/AllProducts/',...categorySources];
 const start=(Math.floor(scheduledTime/600000)*3)%paths.length;
 const cache=createSharedSourceCache(kv);
 const {getCatalog}=catalogFor(kv);
 for(let offset=0;offset<3;offset++){
  if((await cache.retryAt?.()||0)>Date.now())break;
  const path=paths[(start+offset)%paths.length];
  try{
   const hit=await cache.get(ORIGIN+path);
   if(hit&&Date.now()-hit.at<180000)continue;
   await getCatalog(path);
  }catch(error){console.warn('Catalog scheduled refresh deferred',{path,reason:error instanceof Error?error.message:'Source unavailable'});}
 }
}
