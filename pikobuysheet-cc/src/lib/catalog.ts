import { parseHTML } from 'linkedom';
import { createSourceReader } from './source-cache';
export const ORIGIN='https://findspreadsheet.com';
export const REGISTER='https://www.pikobuy.com/?mode=register&redirect=/home';
export const categories=['shoes','hoodies-sweaters','t-shirts','jackets','pants-shorts','headwear','accessories','ShortSets','electronics','other-stuff','jersey'];
export const upstream=createSourceReader(ORIGIN);
export function imageUrl(raw:string|null) {
  if(!raw)return '';try {const u=new URL(raw,ORIGIN);return u.protocol==='https:'?u.href:'';}catch{return '';}
}
export function safeCatalog(raw:string) {
  const u=new URL(raw,ORIGIN);if(u.origin!==ORIGIN)throw new Error('Invalid source');
  if(/^\/(AllProducts|shoes|hoodies-sweaters|t-shirts|jackets|pants-shorts|headwear|accessories|ShortSets|electronics|other-stuff|jersey)\/(list_\d+_\d+\/)?$/.test(u.pathname))return u.pathname;
  if(u.pathname==='/search.html'&&u.searchParams.get('channelid')==='2'){
    const q=u.searchParams.get('keywords')||'';if(q.length>120)throw new Error('Query too long');
    const clean=new URLSearchParams({keywords:q,channelid:'2'});const p=u.searchParams.get('page');if(p&&/^\d{1,4}$/.test(p))clean.set('page',p);
    return '/search.html?'+clean;
  }
  if(u.pathname==='/index.php'&&u.searchParams.get('m')==='home'&&u.searchParams.get('c')==='Search'&&u.searchParams.get('a')==='lists'&&u.searchParams.get('channelid')==='2'&&['new','click','price'].includes(u.searchParams.get('sort')||'')&&['asc','desc'].includes(u.searchParams.get('sort_asc')||'')){
    const q=u.searchParams.get('keywords')||'';if(q.length>120)throw new Error('Query too long');const p=new URLSearchParams();for(const k of ['m','c','a','keywords','channelid','sort','sort_asc'])p.set(k,u.searchParams.get(k)||'');p.set('ZXljbXM','1');const page=u.searchParams.get('page');if(page&&/^\d{1,4}$/.test(page))p.set('page',page);return '/index.php?'+p;
  }
  if(u.pathname==='/index.php'&&u.searchParams.get('m')==='home'&&u.searchParams.get('c')==='Lists'&&u.searchParams.get('a')==='index'&&/^\d{1,5}$/.test(u.searchParams.get('tid')||'')&&['new','click','price'].includes(u.searchParams.get('sort')||'')&&['asc','desc'].includes(u.searchParams.get('sort_asc')||'')) {
    const p=new URLSearchParams();for(const k of ['m','c','a','tid','sort','sort_asc'])p.set(k,u.searchParams.get(k)!);p.set('ZXljbXM','1');const page=u.searchParams.get('page');if(page&&/^\d{1,4}$/.test(page))p.set('page',page);return '/index.php?'+p;
  }
  throw new Error('Invalid catalog path');
}
export function safeProduct(raw:string){if(!/^\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+-\d+\.html$/.test(raw))throw new Error('Invalid product');return raw;}
function navigation(el:any){const onclick=el.getAttribute('onclick')||'';const path=onclick.match(/location\.href\s*=\s*['"]([^'"]+)/)?.[1]||el.getAttribute('href');try{return path?safeCatalog(path):'';}catch{return '';}}
export type Product={path:string,title:string,image:string,rawPrice:string,id:string,category:string};
function cards(doc:any):Product[]{return [...doc.querySelectorAll('.product-card')].map((el:any)=>{
  const path=el.querySelector('.product-image')?.getAttribute('href')||'';
  try {safeProduct(path);}catch{return null;}
  const im=el.querySelector('.product-image img');return {path,title:el.querySelector('.product-name')?.textContent.trim()||im?.getAttribute('alt')||'',image:imageUrl(im?.getAttribute('data-src')||im?.getAttribute('src')),rawPrice:el.querySelector('.product-price')?.textContent.trim()||'',id:el.querySelector('[data-cart-weidian]')?.getAttribute('data-cart-weidian')||'',category:path.split('/')[1]};
}).filter(Boolean);}
export async function getCatalog(path='/AllProducts/'){
 const {document}=parseHTML(await upstream(safeCatalog(path)));
 return {products:cards(document),sorts:[...document.querySelectorAll('.sort-btn')].map((el:any)=>({path:navigation(el),active:el.classList.contains('active'),key:new URL(navigation(el)||'/',ORIGIN).searchParams.get('sort')})).filter(x=>x.path),pages:[...document.querySelectorAll('.pagination a')].map((el:any)=>({path:navigation(el),text:el.textContent.trim(),active:el.parentElement.classList.contains('active')})),activeCategory:document.querySelector('.filter-btn.active')?navigation(document.querySelector('.filter-btn.active')):''};
}
let lastRate:number|undefined;
export async function getRate(){try {const js=await upstream('/template/cnbuynew/pc/static/js/script.js?v=4.7.9',3600000);const n=Number(js.match(/CNY_TO_USD_RATE\s*=\s*([\d.]+)/)?.[1]);if(n>0)lastRate=n;}catch{}return lastRate;}
export function price(raw:string,rate:number|undefined,lang='en'){if(raw.includes('$'))return raw;const n=Number(raw);if(!raw||!Number.isFinite(n))return '—';return new Intl.NumberFormat(lang,{style:'currency',currency:rate?'USD':'CNY',maximumFractionDigits:2}).format(rate?n/rate:n);}
export function buyLink(id:string){if(!/^\d{5,20}$/.test(id))return '';return 'https://www.pikobuy.com/product/detail?'+new URLSearchParams({productUrl:`https://weidian.com/item.html?itemID=${id}`});}
export async function getProduct(path:string){
 const {document}=parseHTML(await upstream(safeProduct(path)));const detail=document.querySelector('.product-detail');if(!detail)throw new Error('Product missing');
 const id=detail.querySelector('[data-cart-weidian]')?.getAttribute('data-cart-weidian')||detail.querySelector('[data-qc-item-id]')?.getAttribute('data-qc-item-id')||'';
 const images=[...new Set([...detail.querySelectorAll('.product-gallery img')].map((im:any)=>imageUrl(im.getAttribute('data-src')||im.getAttribute('src'))).filter(Boolean))];
 return {path,id,title:detail.querySelector('.product-title')?.textContent.trim()||'',images,rawPrice:detail.querySelector('.product-price')?.textContent.trim()||'',related:cards(document)};
}
export async function getSku(id:string){if(!/^\d{5,20}$/.test(id))return null;try{return JSON.parse(await upstream('/api/Goods/getSkuData?weidian_id='+id,300000,0));}catch{return null;}}
export async function getQc(id:string){if(!/^\d{5,20}$/.test(id))return {status:'unavailable',images:[]};try {const data=JSON.parse(await upstream('/qcradar-qc.php?item='+id,60000,0));return {status:data.status,images:Array.isArray(data.images)?data.images.filter((im:any)=>imageUrl(im.display)&&!im.isVideo).map((im:any)=>({url:imageUrl(im.display),label:[im.skuLabel,im.agentPlatform,im.takenAt].filter(Boolean).join(' · ')})):[]};}catch{return {status:'unavailable',images:[]};}}
