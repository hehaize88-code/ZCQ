import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createSharedSourceCache,sourceCacheKey} from '../src/lib/edge-source-cache.ts';
import {createSourceReader} from '../src/lib/source-cache.ts';
import {publicSourceSnapshot,isPublicSnapshotSource} from '../src/lib/source-public-snapshot.ts';
const origin='https://findspreadsheet.com',path='/AllProducts/';
const html='<article class="product-card"><a class="product-image" href="/shoes/real-source-item-123.html"><img src="/real.jpg" alt="Real item"></a><h3 class="product-name">Real source item</h3><div class="product-price">100</div><button data-cart-weidian="1234567890"></button></article>';
const projected=publicSourceSnapshot(origin+path,html);
let clock=Date.now(),calls=0,status=200,body=html;
const captured=clock,entries=new Map();
const kv={get:async key=>{const item=entries.get(key);return item&&item.expiration*1000>clock?JSON.parse(item.value):null;},put:async(key,value,options)=>{entries.set(key,{value,...options});}};
const region=()=>{const localEntries=new Map();return {get:async key=>localEntries.get(key),set:async(key,value)=>{localEntries.set(key,value);}};};
const transport=async()=>{calls++;return new Response(body,{status,headers:status===429?{'Retry-After':'120'}:{}});};
const reader=()=>createSourceReader(origin,transport,()=>clock,createSharedSourceCache(kv,region(),()=>clock),publicSourceSnapshot,isPublicSnapshotSource);
await reader()(path,180000,86220000);
assert.equal(calls,1);
const cacheKey=sourceCacheKey(origin+path).key;
const warmup=JSON.parse(entries.get(cacheKey).value);warmup.needsExpiry=true;
entries.set(cacheKey,{value:JSON.stringify(warmup),expiration:Math.ceil((clock+10*86400000)/1000)});
await createSharedSourceCache(kv,region(),()=>clock).get(origin+path);
assert.equal(JSON.parse(entries.get(cacheKey).value).needsExpiry,false,'dashboard warmup receives a physical TTL without resetting its age');
assert.equal(entries.get(cacheKey).expiration,Math.ceil((captured+86400000)/1000));
assert.equal(JSON.parse(entries.get(cacheKey).value).value,projected);
clock+=4*3600000;status=429;body='limited';
assert.equal(await reader()(path,180000,86220000),projected,'a completely cold region uses a four-hour-old real catalog after 429');
assert.equal(calls,2);
assert.equal(await reader()(path,180000,86220000),projected,'another region shares backoff and catalog');
assert.equal(calls,2,'cooldown prevents another source request');
assert.equal(JSON.parse(entries.get(cacheKey).value).at,captured,'a read must not reset data age');
assert.equal(entries.get(cacheKey).expiration,Math.ceil((captured+86400000)/1000));
clock+=120001;status=200;body='<html><title>Temporary challenge</title></html>';
assert.equal(await reader()(path,180000,86220000),projected,'HTTP 200 error HTML cannot replace the last catalog');
assert.equal(JSON.parse(entries.get(cacheKey).value).at,captured);
status=403;await assert.rejects(reader()(path,180000,86220000),/Source 403/,'blocked resources do not use stale data');
clock=captured+86400001;status=429;
await assert.rejects(reader()(path,180000,86220000),/Source 429/,'catalog has a strict one-day bound');
const shared=createSharedSourceCache(kv,region(),()=>clock);
const before=entries.size;
for(const resource of ['/search.html?keywords=private&channelid=2','/api/Goods/getSkuData?weidian_id=123456','/qcradar-qc.php?item=123456'])await shared.set(origin+resource,{at:clock,value:html},86400000);
assert.equal(entries.size,before,'no searches or SKU/QC stored globally');
for(let i=0;i<300;i++)await shared.set(origin+'/shoes/product-'+i+'.html',{at:clock,value:'<section class="product-detail">'+i+'</section>'},900000);
assert.ok(entries.size<=92,'bounded slots plus cooldowns');

// Verify the built Worker actually passes the configured binding into SSR.
const previousFetch=globalThis.fetch;
const now=Date.now();clock=now;
entries.clear();
entries.set(cacheKey,{value:JSON.stringify({at:now-4*3600000,value:projected,resource:path,expiresAt:now+20*3600000}),expiration:Math.ceil((now+20*3600000)/1000)});
globalThis.fetch=async()=>new Response('limited',{status:429,headers:{'Retry-After':'120'}});
try{
 const {default:app}=await import('../dist/server/index.js');
 const langs=['en','de','es','fr','it','pl','pt','ro','sv','nl','da','fi','el','cs','hu','bg','sk','hr','sl','lt','lv','et','ga','mt'];
 for(const lang of langs){
  const prefix=lang==='en'?'':'/'+lang;
  for(const route of ['/','/spreadsheet/']){
   const response=await app.fetch(new Request('https://pikobuysheet.cc'+prefix+route),{SOURCE_CACHE:{...kv}},{});
   const {document}=parseHTML(await response.text());
   assert.equal(response.status,200,lang+route);
   assert.equal(document.querySelectorAll('.product-card').length,1,lang+route);
   assert.equal(document.querySelector('main[data-catalog-retry]'),null);
   assert.equal(document.querySelectorAll('script[src*="G-0PZGKFFTL6"]').length,1,'GA tag preserved');
  }
 }
 let background;
 await app.scheduled({}, {SOURCE_CACHE:kv},{waitUntil:p=>background=p});
 await background;
 assert.equal(JSON.parse(entries.get(cacheKey).value).at,now-4*3600000,'failed scheduled refresh never makes stale data new');
}finally{globalThis.fetch=previousFetch;}
console.log('PASS: cold-region recovery after four hours, shared Retry-After, absolute expiry, invalid 200 protection, exclusions and bounds, 24-locale SSR binding and scheduled refresh.');
