import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createSourceReader} from '../src/lib/source-cache.ts';

const origin='https://findspreadsheet.com';
let clock=0,calls=0,status=200;
const read=createSourceReader(origin,async()=>{calls++;return new Response(status===200?'real source response':'error',{status,headers:status===429?{'Retry-After':'120'}:{}});},()=>clock);
assert.deepEqual(await Promise.all(Array.from({length:24},()=>read('/AllProducts/',100,300))),Array(24).fill('real source response'));
assert.equal(calls,1,'24 locale requests share one upstream request');
clock=101;status=429;
assert.equal(await read('/AllProducts/',100,300),'real source response');
assert.equal(calls,2);
assert.equal(await read('/AllProducts/',100,300),'real source response');
assert.equal(calls,2,'cooldown does not hit the source again');
await assert.rejects(read('/AllProducts/',100,0),/Source 429/,'strict consumers cannot reuse stale data');
await assert.rejects(read('/shoes/'),/cooldown/,'rate limit applies across source paths');
clock=401;
await assert.rejects(read('/AllProducts/',100,300),/Source 429/,'stale data has a hard expiry');
clock=120100;
await assert.rejects(read('/AllProducts/',100,300),/Source 429/);
assert.equal(calls,2,'Retry-After is respected');
clock=120102;status=200;
assert.equal(await read('/AllProducts/',100,300),'real source response');
assert.equal(calls,3,'fetch resumes after cooldown');
clock+=101;status=404;
await assert.rejects(read('/AllProducts/',100,300),/Source 404/,'deleted resources do not use stale success');
await assert.rejects(read('https://example.org/'),/Invalid source/);

let networkTime=0,networkCalls=0;
const networkRead=createSourceReader(origin,async()=>{networkCalls++;if(networkCalls>1)throw new TypeError('network unavailable');return new Response('verified data');},()=>networkTime);
assert.equal(await networkRead('/AllProducts/',100,300),'verified data');
networkTime=101;
assert.equal(await networkRead('/AllProducts/',100,300),'verified data');
assert.equal(await networkRead('/AllProducts/',100,300),'verified data');
assert.equal(networkCalls,2);

// A new Worker isolate must reuse an existing public source response rather
// than immediately hitting the same rate-limited origin for another locale.
let sharedTime=100000,sharedFetches=0;
const sharedEntries=new Map();
const shared={get:async key=>sharedEntries.get(key),set:async(key,value)=>{sharedEntries.set(key,value);}};
const warm=createSourceReader(origin,async()=>new Response('real shared catalog'),()=>sharedTime,shared);
assert.equal(await warm('/AllProducts/',100,300),'real shared catalog');
const cold=createSourceReader(origin,async()=>{sharedFetches++;return new Response('limited',{status:429});},()=>sharedTime,shared);
assert.equal(await cold('/AllProducts/',100,300),'real shared catalog');
assert.equal(sharedFetches,0,'cold isolate uses fresh edge response');
sharedTime+=101;
assert.equal(await cold('/AllProducts/',100,300),'real shared catalog');
assert.equal(sharedFetches,1,'transient failure can use shared stale response');
assert.equal(sharedEntries.get(origin+'/AllProducts/').at,100000,'reads never reset source age');
sharedTime=100401;
await assert.rejects(cold('/AllProducts/',100,300),/Source 429/,'shared data cannot outlive its stale bound');
const privateRead=createSourceReader(origin,async()=>new Response('private',{headers:{'Cache-Control':'private, no-store'}}),()=>sharedTime,shared);
await privateRead('/private/');assert.equal(sharedEntries.has(origin+'/private/'),false);
const brokenCache={get:async()=>{throw new Error('cache unavailable');},set:async()=>{throw new Error('cache unavailable');}};
const uncached=createSourceReader(origin,async()=>new Response('real uncached catalog'),()=>sharedTime,brokenCache);
assert.equal(await uncached('/AllProducts/'),'real uncached catalog');
let sharedRetry=0,sharedLimitedCalls=0;
const limitedCache={...shared,retryAt:async()=>sharedRetry,backoff:async until=>{sharedRetry=until;}};
const limitedFetch=async()=>{sharedLimitedCalls++;return new Response('limited',{status:429,headers:{'Retry-After':'120'}});};
const limitedA=createSourceReader(origin,limitedFetch,()=>sharedTime,limitedCache);
const limitedB=createSourceReader(origin,limitedFetch,()=>sharedTime,limitedCache);
await assert.rejects(limitedA('/uncached-a/'),/Source 429/);
await assert.rejects(limitedB('/uncached-b/'),/cooldown/);
assert.equal(sharedLimitedCalls,1,'different isolates and resource paths respect shared Retry-After');
sharedTime+=120001;
await assert.rejects(limitedB('/uncached-b/'),/Source 429/);
assert.equal(sharedLimitedCalls,2,'one new attempt is allowed after the shared cooldown');

// Exercise the actual production bundle with an unavailable, cold source.
const previousFetch=globalThis.fetch,previousError=console.error;
let sourceCalls=0,sourceErrors=0;
globalThis.fetch=async(url)=>{
  assert.equal(new URL(url).origin,origin);
  sourceCalls++;
  return new Response('rate limited',{status:429,headers:{'Retry-After':'120'}});
};
console.error=()=>sourceErrors++;
try {
  const {default:app}=await import('../dist/server/index.js');
  const site='https://pikobuysheet.cc';
  const langs=['en','de','es','fr','it','pl','pt','ro','sv','nl','da','fi','el','cs','hu','bg','sk','hr','sl','lt','lv','et','ga','mt'];
  for(const lang of langs){
    const prefix=lang==='en'?'':'/'+lang;
    const response=await app.fetch(new Request(site+prefix+'/'),{},{});
    const {document}=parseHTML(await response.text());
    assert.equal(response.status,200,lang+' homepage');
    assert.equal(response.headers.get('x-robots-tag'),'index, follow');
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(document.querySelector('meta[name="robots"]').content,'index, follow');
    assert.equal(document.querySelector('link[rel="canonical"]').href,site+prefix+'/');
    assert.equal(document.documentElement.lang,lang);
    assert.ok(document.querySelector('.how-section'));
    assert.ok(document.querySelector('.home-articles'));
    assert.equal(document.querySelectorAll('.faqs details').length,4);
    assert.equal(document.querySelectorAll('.product-card').length,0,'no invented products');
    const delay=Number(document.querySelector('main').dataset.catalogRetry);
    assert.ok(delay>60&&delay<=120,'browser recovery honors the source Retry-After');
    const catalog=await app.fetch(new Request(site+prefix+'/spreadsheet/'),{},{});
    assert.equal(catalog.status,503);
    assert.ok(Number(catalog.headers.get('retry-after'))>60&&Number(catalog.headers.get('retry-after'))<=120);
    assert.equal(catalog.headers.get('cache-control'),'no-store');
    await catalog.arrayBuffer();
  }
  for(const path of ['/guide/','/faq/','/articles/','/sitemap-main.xml','/robots.txt']){
    const response=await app.fetch(new Request(site+path),{},{});
    assert.equal(response.status,200,path);
    const text=await response.text();
    if(path==='/sitemap-main.xml')assert.equal((text.match(/<loc>/g)||[]).length,384);
  }
  const detail=await app.fetch(new Request(site+'/products/shoes/test-product-123.html'),{},{});
  assert.equal(detail.status,503);await detail.arrayBuffer();
  const preview=await app.fetch(new Request('https://pikobuysheet-cc.hehaize88.workers.dev/'),{},{});
  assert.equal(preview.headers.get('x-robots-tag'),'noindex, follow');await preview.arrayBuffer();
  for(const path of ['/not-found/','/__internal-source-cache/v1/%2FAllProducts%2F']){
    const invalid=await app.fetch(new Request(site+path),{},{});
    assert.equal(invalid.status,404);await invalid.arrayBuffer();
  }
  assert.equal(sourceCalls,1,'a cold outage does not request optional rates, SKU or QC');
  assert.ok(sourceErrors>=48);
} finally {globalThis.fetch=previousFetch;console.error=previousError;}
console.log('PASS: source coalescing, bounded stale data, Retry-After, cold failures, 24 homepage locales, honest catalog/detail 503, SEO boundaries and stable sitemap');
