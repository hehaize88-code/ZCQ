import {SITE_ORIGIN,isProductionHost} from '../lib/site';
export function GET({url}:{url:URL}){return new Response(isProductionHost(url)?`User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap-pages.xml\n`:'User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain; charset=utf-8'}});}
