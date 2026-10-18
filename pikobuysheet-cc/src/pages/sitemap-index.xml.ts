import { SITE_ORIGIN, isProductionHost } from '../lib/site';

export function GET({ url }: { url: URL }) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${SITE_ORIGIN}/sitemap-pages.xml</loc></sitemap>\n</sitemapindex>\n`;
  return new Response(xml, { headers: {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ...(!isProductionHost(url) ? { 'X-Robots-Tag': 'noindex' } : {})
  } });
}
