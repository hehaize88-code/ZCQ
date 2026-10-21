import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML, DOMParser } from 'linkedom';
import { languages, localized } from '../src/lib/i18n.ts';
import { SITEMAP_URLS } from '../.generated/sitemap-response.mjs';

const origin = 'https://pikobuysheet.cc';
const read = path => readFile('dist/client/' + path, 'utf8');
const expected = new Set(SITEMAP_URLS);
assert.equal(expected.size, 384);
const discovered = new Set();
for (const [lang] of languages) {
  const path = localized(lang, '/sitemap/');
  const { document } = parseHTML(await read(path.slice(1) + 'index.html'));
  assert.equal(document.documentElement.lang, lang);
  assert.equal(document.querySelector('link[rel="canonical"]').href, origin + path);
  assert.equal(document.querySelectorAll('link[hreflang]').length, 25);
  assert.equal(document.querySelectorAll('.article-links a').length, 10);
  assert.equal(document.querySelectorAll('.directory-languages a').length, 24);
  for (const link of document.querySelectorAll('main a[href]')) {
    const url = new URL(link.getAttribute('href'), origin).href;
    assert.ok(expected.has(url), `Unknown or noncanonical link: ${url}`);
    assert.ok(link.textContent.trim(), `Empty link: ${url}`);
    discovered.add(url);
  }
}
assert.deepEqual(discovered, expected, 'HTML directory links must cover every XML sitemap URL');
for (const path of ['sitemap-main.xml', 'sitemap.xml', 'sitemap-pages.xml']) {
  const doc = new DOMParser().parseFromString(await read(path), 'application/xml');
  assert.equal(doc.documentElement.tagName, 'urlset');
  const urls = Array.from(doc.querySelectorAll('loc'), el => el.textContent);
  assert.equal(urls.length, 384);
  assert.deepEqual(new Set(urls), expected);
}
const index = new DOMParser().parseFromString(await read('sitemap-index.xml'), 'application/xml');
assert.equal(index.querySelector('loc').textContent, origin + '/sitemap-main.xml');
assert.deepEqual(new Set((await read('sitemap.txt')).trim().split('\n')), expected);
const headers = await read('_headers');
for (const path of ['sitemap-main.xml','sitemap.xml','sitemap-pages.xml','sitemap-index.xml','sitemap.txt','robots.txt']) {
  assert.ok(headers.includes('/' + path + '\n  Content-Type:'), 'Missing static headers: ' + path);
}
assert.ok(headers.includes('https://:worker.:account.workers.dev/*\n  X-Robots-Tag: noindex'));
console.log('PASS: 24 static directories, 384 crawlable canonical URLs, complete translations, XML/text agreement and preview noindex');
