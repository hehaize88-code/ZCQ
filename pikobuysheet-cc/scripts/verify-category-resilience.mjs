import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {categorySources,sourceCacheKey,createSharedSourceCache} from '../src/lib/edge-source-cache.ts';
const origin='https://findspreadsheet.com';
const roots=['/AllProducts/',...categorySources];
let clock=Date.now();const captured=clock;
const card=path=>`<article class="product-card"><a class="product-image" href="${path}verified-product-123.html"><img src="https://findspreadsheet.com/photo.jpg"></a><h3 class="product-name">Verified ${path}</h3><div class="product-price">126</div><button data-cart-weidian="1234567890"></button></article><a class="filter-btn active" href="${path}"></a>`;
const makeKV=()=>{const entries=new Map();return {entries,get:async key=>{const item=entries.get(key);return item&&item.expiration*1000>clock?JSON.parse(item.value):null;},put:async(key,value,options)=>entries.set(key,{value,...options})};};
const local={get:async()=>undefined,set:async()=>{}};
const kv=makeKV(),shared=createSharedSourceCache(kv,local,()=>clock);
for(const path of roots)await shared.set(origin+path,{at:clock,value:card(path)},86400000);
const rootKeys=roots.map(path=>sourceCacheKey(origin+path).key);
assert.equal(new Set(rootKeys).size,12);
const originalSlots=[27,31,1,62,33,28,21,58,38,52,87];
categorySources.forEach((path,i)=>assert.ok(sourceCacheKey(origin+path).key.endsWith('slot-'+originalSlots[i]),'existing category keys preserved'));
for(let i=0;i<1000;i++){
 const path='/shoes/item-'+i+'.html';
 assert.ok(!rootKeys.includes(sourceCacheKey(origin+path).key),'product traffic cannot use a category slot');
 await shared.set(origin+path,{at:clock,value:'<section class="product-detail"></section>'},900000);
}
for(const path of roots)assert.equal((await shared.get(origin+path)).value,card(path));
assert.ok(kv.entries.size<=90);

const originalFetch=globalThis.fetch;let status=429,calls=[],active=0,peak=0;
globalThis.fetch=async input=>{const path=new URL(input).pathname;calls.push(path);active++;peak=Math.max(peak,active);await new Promise(r=>setImmediate(r));active--;return new Response(status===200?card(path):'limited',{status,headers:status===429?{'Retry-After':'120'}:{}});};
try{
 const {default:app}=await import('../dist/server/index.js');
 clock=Date.now();
 for(const path of roots){const key=sourceCacheKey(origin+path).key;const saved=JSON.parse(kv.entries.get(key).value);saved.at=clock-4*3600000;saved.expiresAt=saved.at+86400000;kv.entries.set(key,{value:JSON.stringify(saved),expiration:Math.ceil(saved.expiresAt/1000)});}
 const langs=['en','de','es','fr','it','pl','pt','ro','sv','nl','da','fi','el','cs','hu','bg','sk','hr','sl','lt','lv','et','ga','mt'];
 for(const lang of langs)for(const path of categorySources){
  const route=(lang==='en'?'':'/'+lang)+'/spreadsheet/?source='+encodeURIComponent(path);
  const response=await app.fetch(new Request('https://pikobuysheet.cc'+route),{SOURCE_CACHE:{...kv}},{});
  const {document}=parseHTML(await response.text());
  assert.equal(response.status,200,lang+path);
  assert.equal(document.querySelectorAll('article.product-card').length,1,lang+path);
  assert.equal(document.querySelector('.product-card h3').textContent,'Verified '+path);
  const selected=new URL(document.querySelector('.category-options .selected').getAttribute('href'),'https://pikobuysheet.cc');
  const collection=path==='/shoes/'?'shoes':path==='/hoodies-sweaters/'?'hoodies':null;
  if(collection)assert.equal(selected.pathname,(lang==='en'?'':'/'+lang)+'/categories/'+collection+'/');else assert.equal(selected.searchParams.get('source'),path);
  assert.equal(document.querySelector('main[data-catalog-retry]'),null);
 }
 assert.equal(calls.length,1,'264 cold locale/category renders share the original 429 cooldown');
 const expired=makeKV();await expired.put(sourceCacheKey(origin+'/jackets/').key,JSON.stringify({at:clock-86400001,expiresAt:clock-1,resource:'/jackets/',value:card('/jackets/')}),{expiration:Math.ceil((clock-1)/1000)});
 const failed=await app.fetch(new Request('https://pikobuysheet.cc/spreadsheet/?source=%2Fjackets%2F'),{SOURCE_CACHE:expired},{});
 const failedDoc=parseHTML(await failed.text()).document;
 assert.equal(failed.status,503);assert.equal(failedDoc.querySelector('main h2').textContent,'Jackets');
 assert.equal(failedDoc.querySelector('.category-options .selected').textContent,'Jackets');
 assert.equal(failedDoc.querySelectorAll('.product-card').length,0);
 status=200;calls=[];const scheduled=makeKV();let background;
 const base=Math.floor(clock/7200000)*7200000;
 for(let i=0;i<4;i++){await app.scheduled({scheduledTime:base+i*600000},{SOURCE_CACHE:scheduled},{waitUntil:p=>background=p});await background;}
 assert.equal(calls.length,12);assert.equal(new Set(calls).size,12);assert.equal(peak,1,'scheduled refreshes are sequential');
 assert.deepEqual([...calls].sort(),[...roots].sort());
 status=429;calls=[];const limited=makeKV();
 await app.scheduled({scheduledTime:base},{SOURCE_CACHE:limited},{waitUntil:p=>background=p});await background;
 assert.equal(calls.length,1,'a 429 stops the scheduled batch');
 await app.scheduled({scheduledTime:base+600000},{SOURCE_CACHE:limited},{waitUntil:p=>background=p});await background;
 assert.equal(calls.length,1,'active shared cooldown suppresses the next batch');
 clock=captured+86400001;
 for(const path of categorySources)assert.equal(await shared.get(origin+path),undefined,'root snapshots have a hard expiry');
 console.log('PASS: all 11 categories across 24 locales survive 4-hour cold-cache 429s, category slots survive 1,000 product writes, 90-entry bound, absolute expiry, selected-category error state, sequential rotating refresh and Retry-After.');
}finally{globalThis.fetch=originalFetch;}
