import {parseHTML} from 'linkedom';

export function isPublicSnapshotSource(source:string){
  const url=new URL(source);
  return url.origin==='https://findspreadsheet.com'&&(
    url.pathname==='/template/cnbuynew/pc/static/js/script.js'&&url.search==='?v=4.7.9'||
    !url.search&&/^\/(AllProducts|shoes|hoodies-sweaters|t-shirts|jackets|pants-shorts|headwear|accessories|ShortSets|electronics|other-stuff|jersey)\/(?:list_\d+_\d+\/|[a-zA-Z0-9-]+-\d+\.html)?$/.test(url.pathname)
  );
}

// Cache only the public fields this site already displays, never the origin's
// session-bearing HTML, scripts, forms, cookies, account widgets or API data.
// The source owner's public catalog is retained temporarily, not copied to a DB.
export function publicSourceSnapshot(source:string,html:string):string|undefined {
  const url=new URL(source);
  if(url.origin!=='https://findspreadsheet.com')return;
  if(url.pathname==='/template/cnbuynew/pc/static/js/script.js'&&url.search==='?v=4.7.9'){
    const rate=Number(html.match(/CNY_TO_USD_RATE\s*=\s*([\d.]+)/)?.[1]);
    return rate>0?`const CNY_TO_USD_RATE=${rate};`:undefined;
  }
  if(url.search||!/^\/(AllProducts|shoes|hoodies-sweaters|t-shirts|jackets|pants-shorts|headwear|accessories|ShortSets|electronics|other-stuff|jersey)\/(?:list_\d+_\d+\/|[a-zA-Z0-9-]+-\d+\.html)?$/.test(url.pathname))return;
  const {document}=parseHTML(html);
  const esc=(value:string|null|undefined)=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const text=(el:any,selector:string)=>esc(el.querySelector(selector)?.textContent.trim());
  const image=(el:any)=>{
    const raw=el?.getAttribute('data-src')||el?.getAttribute('src');
    if(!raw)return '';
    try{if(new URL(raw,url).protocol!=='https:')return '';}catch{return '';}
    return `<img src="${esc(raw)}" alt="${esc(el.getAttribute('alt'))}">`;
  };
  const itemId=(el:any)=>{
    const id=el.querySelector('[data-cart-weidian]')?.getAttribute('data-cart-weidian')||el.querySelector('[data-qc-item-id]')?.getAttribute('data-qc-item-id')||'';
    return /^\d{5,20}$/.test(id)?id:'';
  };
  const cards=[...document.querySelectorAll('.product-card')].map(el=>{
    const href=el.querySelector('.product-image')?.getAttribute('href')||'';
    if(!/^\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+-\d+\.html$/.test(href))return '';
    return `<article class="product-card"><a class="product-image" href="${esc(href)}">${image(el.querySelector('.product-image img'))}</a><h3 class="product-name">${text(el,'.product-name')}</h3><div class="product-price">${text(el,'.product-price')}</div><button data-cart-weidian="${itemId(el)}"></button></article>`;
  }).join('');
  let detail='';
  if(url.pathname.endsWith('.html')){
    const el=document.querySelector('.product-detail');
    if(!el||!el.querySelector('.product-title'))return;
    detail=`<section class="product-detail"><h1 class="product-title">${text(el,'.product-title')}</h1><div class="product-price">${text(el,'.product-price')}</div><button data-cart-weidian="${itemId(el)}"></button><div class="product-gallery">${[...el.querySelectorAll('.product-gallery img')].map(image).join('')}</div></section>`;
  }else if(!cards)return;
  const link=(el:any,cls:string)=>{
    const raw=(el.getAttribute('onclick')||'').match(/location\.href\s*=\s*['"]([^'"]+)/)?.[1]||el.getAttribute('href');
    if(!raw)return '';
    try{if(new URL(raw,url).origin!==url.origin)return '';}catch{return '';}
    return `<a class="${cls}" href="${esc(raw)}">${esc(el.textContent.trim())}</a>`;
  };
  const sorts=[...document.querySelectorAll('.sort-btn')].map(el=>link(el,'sort-btn'+(el.classList.contains('active')?' active':''))).join('');
  const pages=[...document.querySelectorAll('.pagination a')].map(el=>`<span class="${el.parentElement?.classList.contains('active')?'active':''}">${link(el,'')}</span>`).join('');
  const active=document.querySelector('.filter-btn.active');
  return `<main>${detail}${cards}${sorts}<nav class="pagination">${pages}</nav>${active?link(active,'filter-btn active'):''}</main>`;
}
