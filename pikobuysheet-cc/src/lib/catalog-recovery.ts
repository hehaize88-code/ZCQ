// One browser recovery attempt after the source's cooldown, never a retry loop.
// Fetch only this same page; all product data still comes through the server.
export function scheduleCatalogRecovery(doc:Document,win:Window){
  const main=doc.querySelector<HTMLElement>('main[data-catalog-retry]');
  const seconds=Number(main?.dataset.catalogRetry);
  if(!main||!Number.isFinite(seconds)||seconds<=0||seconds>2147483)return;
  const path=win.location.pathname+win.location.search;
  const recover=async()=>{
    if(!main.isConnected||win.location.pathname+win.location.search!==path)return;
    try {
      const response=await win.fetch(path,{headers:{Accept:'text/html'},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
      if(!response.ok||!response.headers.get('Content-Type')?.includes('text/html'))return;
      const next=new DOMParser().parseFromString(await response.text(),'text/html');
      const current=doc.querySelector('.catalog-section');
      const replacement=next.querySelector('.catalog-section');
      // An outage/challenge/empty result must not replace the current page.
      if(next.querySelector('main[data-catalog-retry]')||!replacement?.querySelector('.product-card')||!current)return;
      // Preserve a search the visitor is currently typing.
      if(current.contains(doc.activeElement)&&doc.activeElement?.matches('input,textarea,select'))return;
      current.replaceWith(doc.importNode(replacement,true));
      const oldHero=doc.querySelector('.hero-showcase'),newHero=next.querySelector('.hero-showcase');
      if(oldHero&&newHero)oldHero.replaceWith(doc.importNode(newHero,true));
      delete main.dataset.catalogRetry;
    }catch{/* Leave the existing manual retry link available. */}
  };
  win.setTimeout(()=>{
    if(doc.visibilityState==='hidden'){
      const visible=()=>{if(doc.visibilityState==='visible'){doc.removeEventListener('visibilitychange',visible);void recover();}};
      doc.addEventListener('visibilitychange',visible);
    }else void recover();
  },seconds*1000+1000);
}
