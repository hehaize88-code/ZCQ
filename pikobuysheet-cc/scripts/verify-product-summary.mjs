import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {sourceCacheKey} from '../src/lib/edge-source-cache.ts';
import {createSourceReader} from '../src/lib/source-cache.ts';
const origin='https://findspreadsheet.com';
const item='/accessories/verified-socks-9018.html';
const card=`<article class="product-card"><a class="product-image" href="${item}"><img src="https://findspreadsheet.com/verified.jpg"></a><h3 class="product-name">Verified catalog socks</h3><div class="product-price">126</div><button data-cart-weidian="1234567890"></button></article>`;
const now=Date.now();
function namespace({expired=false,matching=true}={}){
 const data=new Map();
 const add=(path,value,at)=>data.set(sourceCacheKey(origin+path).key,{resource:path,value,at,expiresAt:at+86400000});
 add('/AllProducts/',matching?card:card.replace(item,'/accessories/another-item-9017.html'),now-(expired?86400001:3600000));
 add('/template/cnbuynew/pc/static/js/script.js?v=4.7.9','const CNY_TO_USD_RATE=7.26;',now);
 return {get:async key=>data.get(key)||null,put:async(key,value)=>data.set(key,JSON.parse(value)),data};
}
let calls=[],mode=429;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input)=>{
 const url=new URL(input);calls.push(url.pathname);
 if(url.pathname.startsWith('/api/'))return new Response('{}');
 if(mode==='network')throw new TypeError('offline');
 if(mode==='invalid')return new Response('<html>Temporary error</html>');
 if(mode==='full')return new Response(`<section class="product-detail"><h1 class="product-title">Complete verified socks</h1><div class="product-price">126</div><button data-cart-weidian="1234567890"></button><div class="product-gallery"><img src="https://findspreadsheet.com/a.jpg"><img src="https://findspreadsheet.com/b.jpg"></div></section>`);
 return new Response('unavailable',{status:mode});
};
try{
 const {default:app}=await import('../dist/server/index.js');
 const langs=['en','de','es','fr','it','pl','pt','ro','sv','nl','da','fi','el','cs','hu','bg','sk','hr','sl','lt','lv','et','ga','mt'];
 const render=async(lang='en',kv=namespace())=>{
  calls=[];
  const response=await app.fetch(new Request('https://pikobuysheet.cc'+(lang==='en'?'':'/'+lang)+'/products'+item),{SOURCE_CACHE:kv},{});
  return {response,document:parseHTML(await response.text()).document};
 };
 for(const lang of langs){
  mode=429;const kv=namespace(),before=kv.data.get(sourceCacheKey(origin+'/AllProducts/').key).at;
  const {response,document}=await render(lang,kv);
  assert.equal(response.status,200,lang);
  assert.equal(document.querySelector('h1')?.textContent,'Verified catalog socks');
  assert.equal(document.querySelector('#main-image')?.getAttribute('src'),'https://findspreadsheet.com/verified.jpg');
  assert.match(document.querySelector('.detail-price')?.textContent,/17[.,]36/);
  const buy=new URL(document.querySelector('.buy-button').getAttribute('href'));
  assert.equal(buy.searchParams.get('productUrl'),'https://weidian.com/item.html?itemID=1234567890');
  assert.ok(document.querySelector('.detail-summary-notice')?.textContent.length>40);
  assert.deepEqual(calls,[item],'no new source, SKU or QC request for a summary');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(kv.data.get(sourceCacheKey(origin+'/AllProducts/').key).at,before);
 }
 for(const transient of [500,'network','invalid']){
  mode=transient;const {response,document}=await render();
  assert.equal(response.status,200);assert.ok(document.querySelector('.detail-summary-notice'));
  assert.deepEqual(calls,[item]);
 }
 for(const permanent of [403,404,410]){
  mode=permanent;const {response,document}=await render();
  assert.equal(response.status,permanent===403?503:404);
  assert.equal(document.querySelector('.detail-summary-notice'),null);
  assert.equal(document.querySelector('.buy-button'),null);
 }
 mode=429;
 for(const options of [{expired:true},{matching:false}]){
  const {response,document}=await render('en',namespace(options));
  assert.equal(response.status,503);assert.equal(document.querySelector('.buy-button'),null);
 }
 mode='full';const {response,document}=await render();
 assert.equal(response.status,200);assert.equal(document.querySelector('.detail-summary-notice'),null);
 assert.equal(document.querySelectorAll('.thumbnails button').length,2);
 assert.equal(document.querySelector('h1').textContent,'Complete verified socks');
 let reads=0,clock=1000;
 const read=createSourceReader(origin,async()=>{reads++;return new Response('verified');},()=>clock);
 await read('/AllProducts/');clock=1500;
 assert.equal(await read.cached('/AllProducts/',1000),'verified');
 clock=2000;assert.equal(await read.cached('/AllProducts/',1000),undefined);
 assert.equal(reads,1,'cache-only lookup cannot fetch or extend age');
 console.log('PASS: 24 locales retain authentic catalog facts and buying links during transient detail failures; no extra origin calls; no fallback for 403/404/410, expired or mismatched cards; full detail recovery.');
}finally{globalThis.fetch=originalFetch;}
