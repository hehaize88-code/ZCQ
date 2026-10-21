import { mkdir, writeFile } from 'node:fs/promises';
import { SITEMAP_XML, SITEMAP_BYTES, SITEMAP_URLS } from '../.generated/sitemap-response.mjs';

// These public crawler files must be available before the application Worker
// starts. Cloudflare's default asset-first routing serves them independently.
export async function writeCrawlerAssets(directory = 'dist/client') {
  if (Buffer.byteLength(SITEMAP_XML) !== SITEMAP_BYTES || !SITEMAP_XML.trimEnd().endsWith('</urlset>')) {
    throw new Error('Incomplete generated XML sitemap');
  }
  if (!SITEMAP_URLS.length || new Set(SITEMAP_URLS).size !== SITEMAP_URLS.length) {
    throw new Error('Empty or duplicate sitemap URLs');
  }
  for (const value of SITEMAP_URLS) {
    const url = new URL(value);
    if (url.origin !== 'https://pikobuysheet.cc' || url.search || url.hash || /\s/.test(value)) {
      throw new Error('Invalid canonical sitemap URL: ' + value);
    }
  }
  const files = {
    'sitemap-main.xml': [SITEMAP_XML, 'application/xml; charset=utf-8'],
    'sitemap.xml': [SITEMAP_XML, 'application/xml; charset=utf-8'],
    'sitemap-pages.xml': [SITEMAP_XML, 'application/xml; charset=utf-8'],
    'sitemap-index.xml': ['<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://pikobuysheet.cc/sitemap-main.xml</loc></sitemap></sitemapindex>\n', 'application/xml; charset=utf-8'],
    'sitemap.txt': [SITEMAP_URLS.join('\n') + '\n', 'text/plain; charset=utf-8'],
    'robots.txt': ['User-agent: *\nAllow: /\n\nSitemap: https://pikobuysheet.cc/sitemap-main.xml\nSitemap: https://pikobuysheet.cc/sitemap.txt\n', 'text/plain; charset=utf-8']
  };
  await mkdir(directory, { recursive: true });
  for (const [name, [body]] of Object.entries(files)) await writeFile(directory + '/' + name, body);
  const headers = Object.entries(files).map(([name, [, type]]) =>
    '/' + name + '\n  Content-Type: ' + type + '\n  Cache-Control: public, max-age=300, no-transform\n  X-Content-Type-Options: nosniff\n  X-Crawler-Delivery: static-v2\n'
  ).join('\n') + '\nhttps://:worker.:account.workers.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:version.:worker.:account.workers.dev/*\n  X-Robots-Tag: noindex\n';
  await writeFile(directory + '/_headers', headers);
  console.log('Static crawler files written:', SITEMAP_URLS.length, 'canonical URLs');
}
