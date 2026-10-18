import { createApp } from 'astro/app/entrypoint';
import {catalogFor} from '../src/lib/catalog.ts';
import { SITEMAP_XML, SITEMAP_BYTES } from '../.generated/sitemap-response.mjs';
const app = createApp();
export default { async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if(url.hostname==='www.pikobuysheet.cc'){url.hostname='pikobuysheet.cc';url.protocol='https:';return Response.redirect(url.href,301);}
  if(url.pathname==='/sitemap-main.xml'){
    if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    return new Response(request.method==='HEAD'?null:SITEMAP_XML,{headers:{
      'Content-Type':'application/xml; charset=utf-8',
      'Content-Length':String(SITEMAP_BYTES),
      'Cache-Control':'public, max-age=3600',
      ...(url.hostname==='pikobuysheet.cc'?{}:{'X-Robots-Tag':'noindex'})
    }});
  }
  return app.render(request, { locals: {sourceCache: env?.SOURCE_CACHE}, waitUntil: ctx?.waitUntil?.bind(ctx) });
}, async scheduled(controller,env,ctx){
  // One normal, rate-limit-aware refresh every ten minutes. No retry loop,
  // and no extension of the successful snapshot's original age on failures.
  if(!env?.SOURCE_CACHE)return;
  ctx.waitUntil((async()=>{
    try{await catalogFor(env.SOURCE_CACHE).getCatalog();}
    catch(error){console.warn('Catalog scheduled refresh deferred',{reason:error instanceof Error?error.message:'Source unavailable'});}
  })());
}};
