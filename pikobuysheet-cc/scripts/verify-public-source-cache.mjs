import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {publicSourceSnapshot} from '../src/lib/source-public-snapshot.ts';
import {createSourceReader,SourceRetryError} from '../src/lib/source-cache.ts';
import {edgeSourceCache} from '../src/lib/edge-source-cache.ts';

const origin='https://findspreadsheet.com';
const card='<article class="product-card"><a class="product-image" href="/shoes/source-product-123.html"><img data-src="/real.jpg" alt="Source photo"></a><h3 class="product-name">Real &amp; Public</h3><div class="product-price">126</div><button data-cart-weidian="1234567890"></button></article>';
const detail='<section class="product-detail"><h1 class="product-title">Real &amp; Public</h1><div class="product-price">126</div><button data-cart-weidian="1234567890"></button><div class="product-gallery"><img src="/real.jpg"><img data-src="/second.jpg"></div></section>';
const privateParts='<header>ACCOUNT_PRIVATE_TEST</header><script>const csrf="TOKEN_PRIVATE_TEST"</script><form><input name="password" value="PASSWORD_PRIVATE_TEST"></form>';
const original=privateParts+detail+card;
const source=origin+'/shoes/source-product-123.html';
const projected=publicSourceSnapshot(source,original);
assert.ok(projected&&!/PRIVATE_TEST|script|form|password|csrf/i.test(projected));
const {document}=parseHTML(projected);
assert.equal(document.querySelector('.product-title').textContent,'Real & Public');
assert.equal(document.querySelectorAll('.product-gallery img').length,2);
assert.equal(document.querySelector('.product-card .product-image').getAttribute('href'),'/shoes/source-product-123.html');
for(const path of ['/search.html?keywords=private','/api/Goods/getSkuData?weidian_id=1234567890','/qcradar-qc.php?item=1234567890','/user/','/shoes/source-product-123.html?session=private'])assert.equal(publicSourceSnapshot(origin+path,original),undefined);
assert.equal(publicSourceSnapshot('https://other.example/shoes/source-product-123.html',original),undefined);
assert.equal(publicSourceSnapshot(source,'<html>Challenge</html>'),undefined);
const listing=publicSourceSnapshot(origin+'/AllProducts/',privateParts+card+'<a class="sort-btn active" onclick="location.href=\'/index.php?m=home&c=Lists&a=index&tid=1&sort=price&sort_asc=asc\'">Price</a><nav class="pagination"><span class="active"><a href="/AllProducts/list_1_2/">2</a></span></nav><a class="filter-btn active" href="/shoes/">Shoes</a>');
const listingDoc=parseHTML(listing).document;
assert.ok(listingDoc.querySelector('.sort-btn.active').getAttribute('href').includes('sort=price'));
assert.equal(listingDoc.querySelector('.pagination .active a').textContent,'2');
assert.equal(listingDoc.querySelector('.filter-btn.active').getAttribute('href'),'/shoes/');

let clock=Date.now(),calls=0;
const entries=new Map(),previousCaches=globalThis.caches;
globalThis.caches={open:async()=>({match:async key=>entries.get(key)?.clone(),put:async(key,response)=>entries.set(key,response.clone())})};
try {
  const transport=async()=>{calls++;return new Response(original,{headers:{'Cache-Control':'no-store, no-cache, must-revalidate','Set-Cookie':'SESSION=PRIVATE_TEST'}});};
  const warm=createSourceReader(origin,transport,()=>clock,edgeSourceCache,publicSourceSnapshot);
  const cold=createSourceReader(origin,transport,()=>clock,edgeSourceCache,publicSourceSnapshot);
  assert.equal(await warm('/shoes/source-product-123.html',100,300),original);
  const hit=await cold('/shoes/source-product-123.html',100,300);
  assert.equal(hit,projected);
  assert.equal(calls,1,'cold isolates reuse public facts despite PHP session/no-store wrappers');
  const cached=await edgeSourceCache.get(source);
  assert.equal(cached.at,clock);assert.equal(cached.value,projected);
  assert.ok([...entries.keys()].some(k=>k.includes('/v2/')));
  for(const response of entries.values())assert.equal(response.headers.get('Set-Cookie'),null);
  clock+=401;
  await cold('/shoes/source-product-123.html',100,300);
  assert.equal(calls,2,'public snapshots expire at their original retention bound');
}finally{if(previousCaches===undefined)delete globalThis.caches;else globalThis.caches=previousCaches;}

// Mixed cold URLs must not turn a crawler burst into a burst at the source.
let transportCalls=0,peak=0,inflight=0;
const releases=[];
const limited=createSourceReader(origin,async()=>{
 transportCalls++;inflight++;peak=Math.max(peak,inflight);
 await new Promise(resolve=>releases.push(resolve));inflight--;
 return new Response('rate limited',{status:429,headers:{'Retry-After':'120'}});
},()=>clock);
const burst=Promise.allSettled(Array.from({length:10},(_,i)=>limited('/shoes/item-'+i+'.html')));
await new Promise(resolve=>setImmediate(resolve));
assert.equal(transportCalls,2);assert.equal(peak,2);
for(const release of releases)release();
const results=await burst;
assert.equal(transportCalls,2,'queued requests stop after the first origin 429');
assert.ok(results.every(r=>r.status==='rejected'&&r.reason instanceof SourceRetryError));
assert.equal(results.filter(r=>/queue busy/.test(r.reason.message)).length,2,'queue size stays bounded');

// Optional local live source fixture: verify the actual product keeps all photos.
if(process.argv[2]){
 const raw=readFileSync(process.argv[2],'utf8');
 const snap=publicSourceSnapshot(origin+'/accessories/orb-graphic-crew-socks-9018.html',raw);
 const before=parseHTML(raw).document,after=parseHTML(snap).document;
 assert.equal(after.querySelector('.product-title').textContent,before.querySelector('.product-title').textContent);
 assert.equal(after.querySelectorAll('.product-gallery img').length,before.querySelectorAll('.product-gallery img').length);
 assert.equal(after.querySelectorAll('.product-card').length,before.querySelectorAll('.product-card').length);
 console.log('Real public product snapshot:',raw.length,'->',snap.length,'bytes; photos and related products preserved');
}
console.log('PASS: public-only fields, no session data, cross-isolate reuse, original expiry, bounded concurrency and queued 429 suppression');
