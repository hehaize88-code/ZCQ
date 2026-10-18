import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';

const previousFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async raw=>{
  const url=new URL(raw);assert.equal(url.origin,'https://findspreadsheet.com');calls.push(url);
  if(url.pathname==='/qcradar-qc.php'){
    if(url.searchParams.get('item')==='1234567891')return new Response('limited',{status:429,headers:{'Retry-After':'120'}});
    return Response.json({status:'success',images:[{display:'https://findspreadsheet.com/test-qc.jpg',skuLabel:'Source QC'}]});
  }
  if(url.pathname==='/api/Goods/getSkuData')return Response.json({specifications:{attrs:[]}});
  if(url.pathname.includes('/static/'))return new Response('const CNY_TO_USD_RATE=7;');
  const id=url.pathname.includes('limited')?'1234567891':'1234567890';
  return new Response(`<section class="product-detail"><h1 class="product-title">Source product</h1><div class="product-price">100</div><button data-cart-weidian="${id}"></button><div class="product-gallery"><img src="/test-product.jpg"></div></section>`);
};
try{
  const {default:app}=await import('../dist/server/index.js');
  const site='https://pikobuysheet.cc';
  const product='/products/accessories/source-product-123.html';
  const langs=['en','de','es','fr','it','pl','pt','ro','sv','nl','da','fi','el','cs','hu','bg','sk','hr','sl','lt','lv','et','ga','mt'];
  for(const lang of langs){
    const path=(lang==='en'?'':'/'+lang)+product;
    const response=await app.fetch(new Request(site+path),{},{});
    assert.equal(response.status,200);assert.equal(response.headers.get('x-robots-tag'),'index, follow');
    const {document}=parseHTML(await response.text());
    assert.equal(document.querySelector('h1').textContent,'Source product');
    const form=document.querySelector('#qc form');assert.ok(form);
    assert.equal(form.getAttribute('method'),'get');assert.equal(form.getAttribute('action'),path+'#qc');
    assert.equal(form.querySelector('button').getAttribute('name'),'qc');
    assert.equal(form.querySelector('button').getAttribute('value'),'1');
    assert.ok(form.querySelector('button').textContent);
  }
  assert.equal(calls.filter(u=>u.pathname==='/qcradar-qc.php').length,0,'normal visits in every locale never call optional QC');
  const opened=await app.fetch(new Request(site+'/de'+product+'?qc=1'),{},{});
  assert.equal(opened.status,200);assert.equal(opened.headers.get('x-robots-tag'),'noindex, follow');
  const {document}=parseHTML(await opened.text());
  assert.equal(document.querySelector('#qc .qc-grid img').getAttribute('src'),'https://findspreadsheet.com/test-qc.jpg');
  assert.equal(calls.filter(u=>u.pathname==='/qcradar-qc.php').length,1,'one deliberate request loads real source QC');
  const limited=await app.fetch(new Request(site+'/products/accessories/limited-product-124.html?qc=1'),{},{});
  assert.equal(limited.status,200);
  const body=await limited.text();assert.ok(body.includes('Source product'));assert.ok(!body.includes('test-qc.jpg'));
  const count=calls.length;
  const home=await app.fetch(new Request(site+'/'),{},{});
  assert.match(await home.text(),/data-catalog-retry="1[12]\d"/);
  assert.equal(calls.length,count,'source-wide Retry-After is still respected after explicit QC is limited');
}finally{globalThis.fetch=previousFetch;}
console.log('PASS: 24 locales skip automatic QC, explicit form loads source photos, QC outage keeps product visible, origin cooldown respected');
