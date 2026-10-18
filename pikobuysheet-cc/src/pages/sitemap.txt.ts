import { SITE_ORIGIN, isProductionHost } from '../lib/site';
import { languages, localized } from '../lib/i18n';
import { getSitemapPaths } from '../lib/sitemap';

const body = getSitemapPaths().flatMap(path => languages.map(([lang]) =>
  new URL(localized(lang, path), SITE_ORIGIN).href)).join('\n') + '\n';

export function GET({ url }: { url: URL }) {
  return new Response(body, { headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ...(!isProductionHost(url) ? { 'X-Robots-Tag': 'noindex' } : {})
  } });
}
