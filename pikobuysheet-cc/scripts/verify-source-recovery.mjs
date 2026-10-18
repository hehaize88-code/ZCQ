import assert from 'node:assert/strict';
import {edgeSourceCache} from '../src/lib/edge-source-cache.ts';
import {createSourceReader} from '../src/lib/source-cache.ts';

const origin='https://findspreadsheet.com';
const entries=new Map();
const previousCaches=globalThis.caches;
globalThis.caches={open:async()=>({
  match:async key=>entries.get(key)?.clone(),
  put:async(key,response)=>entries.set(key,response.clone())
})};
const detail='<section class="product-detail"><h1 class="product-title">Verified source product</h1><div class="product-price">100</div></section>';
try {
  const source=origin+'/accessories/shared-product-123.html';
  const entry={at:Date.now(),value:detail};
  await edgeSourceCache.set(source,entry,900000);
  let calls=0;
  const cold=createSourceReader(origin,async()=>{calls++;return new Response('limited',{status:429});},Date.now,edgeSourceCache);
  assert.equal(await cold('/accessories/shared-product-123.html'),detail);
  assert.equal(calls,0,'a cold isolate reuses a real product across locales');

  entries.clear();
  await edgeSourceCache.set(origin+'/AllProducts/',{...entry,value:'<div class="product-card"></div>'},900000);
  await edgeSourceCache.set(origin+'/template/cnbuynew/pc/static/js/script.js?v=4.7.9',{...entry,value:'const CNY_TO_USD_RATE=7;'},4320000);
  for(let i=0;i<300;i++)await edgeSourceCache.set(origin+'/shoes/product-'+i+'.html',{...entry,value:detail+String(i)},900000);
  assert.ok(entries.size<=90,'shared successful responses are bounded to 90 slots');
  for(let i=0;i<300;i++){
    const hit=await edgeSourceCache.get(origin+'/shoes/product-'+i+'.html');
    if(hit)assert.equal(hit.value,detail+String(i),'slot collision cannot return another product');
  }
  assert.equal((await edgeSourceCache.get(origin+'/AllProducts/')).value,'<div class="product-card"></div>');
  const size=entries.size;
  for(const path of ['/search.html?keywords=private&channelid=2','/api/Goods/getSkuData?weidian_id=123456','/qcradar-qc.php?item=123456']){
    await edgeSourceCache.set(origin+path,entry,900000);
    assert.equal(await edgeSourceCache.get(origin+path),undefined);
  }
  await edgeSourceCache.set('https://example.com/shoes/product-1.html',entry,900000);
  assert.equal(entries.size,size,'searches, SKU, QC and external origins are excluded');
  entries.clear();
  await edgeSourceCache.set(source,{...entry,value:'<html><title>Challenge</title></html>'},900000);
  assert.equal(entries.size,0,'a 200 challenge page is not a valid shared product');

  const previousFetch=globalThis.fetch;
  const requested=[];
  globalThis.fetch=async raw=>{
    const url=new URL(raw);assert.equal(url.origin,origin);requested.push(url.pathname);
    if(url.pathname.includes('deleted'))return new Response('not found',{status:404});
    if(url.pathname.includes('gone'))return new Response('gone',{status:410});
    if(url.pathname.includes('/static/'))return new Response('const CNY_TO_USD_RATE=7;');
    return new Response(detail);
  };
  try {
    const {default:app}=await import('../dist/server/index.js');
    const site='https://pikobuysheet.cc';
    const invalid=await app.fetch(new Request(site+'/products/invalid/'),{},{});
    assert.equal(invalid.status,404);await invalid.arrayBuffer();
    assert.equal(requested.length,0,'invalid product paths do not fetch optional exchange rates');
    for(const name of ['deleted','gone'])for(const prefix of ['','/de']){
      const response=await app.fetch(new Request(site+prefix+'/products/shoes/'+name+'-123.html'),{},{});
      assert.equal(response.status,404);
      assert.equal(response.headers.get('x-robots-tag'),'noindex, follow');
      await response.arrayBuffer();
    }
    assert.deepEqual(requested,['/shoes/deleted-123.html','/shoes/gone-123.html']);
    requested.length=0;
    const langs=['en','de','es','fr','it','pl','pt','ro','sv','nl','da','fi','el','cs','hu','bg','sk','hr','sl','lt','lv','et','ga','mt'];
    for(const lang of langs){
      const response=await app.fetch(new Request(site+(lang==='en'?'':'/'+lang)+'/products/accessories/shared-product-123.html'),{},{});
      assert.equal(response.status,200);
      assert.equal(response.headers.get('x-robots-tag'),'index, follow');
      assert.ok((await response.text()).includes('Verified source product'));
    }
    assert.deepEqual(requested,['/accessories/shared-product-123.html','/template/cnbuynew/pc/static/js/script.js']);
  } finally {globalThis.fetch=previousFetch;}
} finally {
  if(previousCaches===undefined)delete globalThis.caches;else globalThis.caches=previousCaches;
}
console.log('PASS: bounded shared product cache, collision isolation, no search/SKU/QC caching, honest source 404/410, primary request priority, 24 product locales');
