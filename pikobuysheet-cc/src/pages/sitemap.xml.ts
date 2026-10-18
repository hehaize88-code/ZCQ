import {SITE_ORIGIN,isProductionHost} from '../lib/site';
import {languages,localized} from '../lib/i18n';
import {getSitemapPaths} from '../lib/sitemap';
export async function GET({url}:{url:URL}){
 const paths=await getSitemapPaths();
 const absolute=(lang:string,path:string)=>new URL(localized(lang,path),SITE_ORIGIN).href;
 const urls=paths.flatMap(path=>languages.map(([lang])=>`<url><loc>${absolute(lang,path)}</loc>${languages.map(([id])=>`<xhtml:link rel="alternate" hreflang="${id}" href="${absolute(id,path)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${absolute('en',path)}"/></url>`));
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600',...(!isProductionHost(url)?{'X-Robots-Tag':'noindex'}:{})}});
}
