import assert from 'node:assert/strict';
import {parseHTML,DOMParser} from 'linkedom';
import {scheduleCatalogRecovery} from '../src/lib/catalog-recovery.ts';
import {createSourceReader,SourceRetryError} from '../src/lib/source-cache.ts';

const originalParser=globalThis.DOMParser;
globalThis.DOMParser=DOMParser;
const failure='<html><body><main data-catalog-retry="120"><div class="hero-showcase">Unavailable</div><section class="catalog-section"><a href="/">Try again</a></section></main></body></html>';
const success='<html><body><main><div class="hero-showcase"><img src="https://findspreadsheet.com/real.jpg"></div><section class="catalog-section"><article class="product-card">Real recovered product</article></section></main></body></html>';
try {
  for(const [status,html,shouldRecover] of [[200,success,true],[503,failure,false],[200,failure,false],[200,'<html><body>Challenge</body></html>',false]]){
    const {document}=parseHTML(failure);let timer,calls=0;
    const win={location:{pathname:'/',search:''},setTimeout:(callback,delay)=>{assert.equal(delay,121000);timer=callback;},fetch:async(path,options)=>{calls++;assert.equal(path,'/');assert.equal(options.credentials,'omit');return new Response(html,{status,headers:{'Content-Type':'text/html'}});}};
    scheduleCatalogRecovery(document,win);
    assert.equal(calls,0,'no request before cooldown');
    timer();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,1,'one attempt only');
    assert.equal(!!document.querySelector('.product-card'),shouldRecover);
    assert.equal(!!document.querySelector('main[data-catalog-retry]'),!shouldRecover);
  }
  const {document}=parseHTML(success);let scheduled=false;
  scheduleCatalogRecovery(document,{setTimeout:()=>{scheduled=true;}});
  assert.equal(scheduled,false,'healthy pages never schedule extra requests');
}finally{globalThis.DOMParser=originalParser;}

// Fixed public catalog can survive an interruption past the old 15-minute
// limit, but never serve a response more than one hour after it was fetched.
let clock=1,calls=0;
const reader=createSourceReader('https://findspreadsheet.com',async()=>{calls++;return calls===1?new Response('real public catalog'):new Response('limited',{status:429,headers:{'Retry-After':'120'}});},()=>clock);
assert.equal(await reader('/AllProducts/',180000,3420000),'real public catalog');
clock=20*60000;
assert.equal(await reader('/AllProducts/',180000,3420000),'real public catalog');
clock+=1000;
await assert.rejects(reader('/uncached/'),error=>error instanceof SourceRetryError&&error.retryAt===20*60000+120000);
assert.equal(calls,2,'shared origin cooldown prevents retries');
clock=3600002;
await assert.rejects(reader('/AllProducts/',180000,3420000),/Source 429/,'one-hour hard bound');
console.log('PASS: one-shot browser recovery, exact cooldown, no challenge replacement, healthy pages unchanged, one-hour public-list bound');
