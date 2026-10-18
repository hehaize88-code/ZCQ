import { SITE_ORIGIN, isProductionHost } from '../lib/site';
import { languages, localized } from '../lib/i18n';
import { getSitemapPaths, escapeXml } from '../lib/sitemap';

export async function GET({ url }: { url: URL }) {
  const paths = await getSitemapPaths();
  const entries = paths.flatMap(path => languages.map(([lang]) =>
    `  <url><loc>${escapeXml(new URL(localized(lang, path), SITE_ORIGIN).href)}</loc></url>`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ...(!isProductionHost(url) ? { 'X-Robots-Tag': 'noindex' } : {})
  } });
}
