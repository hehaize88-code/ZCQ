import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import { languages, localized } from '../src/lib/i18n.ts';
import { sourceCacheKey } from '../src/lib/edge-source-cache.ts';

const origin = 'https://pikobuysheet.cc';
const source = 'https://findspreadsheet.com';
const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = async () => {
  networkCalls++;
  return new Response('rate limited', { status: 429, headers: { 'Retry-After': '120' } });
};
try {
  const { default: app } = await import('../dist/server/index.js');
  const render = async (path, env = {}) => {
    const response = await app.fetch(new Request(origin + path), env, {});
    const window = parseHTML(await response.text());
    return { response, document: window.document, window };
  };
  const newSlugs = ['pikobuy-sneaker-finds','pikobuy-hoodie-finds','pikobuy-fees'];
  let analyticsPage;
  for (const [lang] of languages) {
    const data = JSON.parse(await readFile(`src/content/editorial/${lang}.json`, 'utf8'));
    const home = await render(localized(lang, '/'));
    assert.equal(home.response.status, 200, lang);
    assert.equal(home.document.title, data.ui.homeTitle);
    assert.equal(home.document.querySelectorAll('.home-articles .article-card').length, 6);
    const links = [...home.document.querySelectorAll('.home-articles .article-card')].map(a => a.getAttribute('href'));
    newSlugs.forEach(slug => assert.ok(links.includes(localized(lang, '/articles/' + slug + '/'))));
    for (const [i, name] of ['shoes', 'hoodies'].entries()) {
      const path = localized(lang, '/categories/' + name + '/');
      const { response, document } = await render(path);
      assert.equal(response.status, 200, path + ': useful category content survives source429');
      assert.equal(response.headers.get('x-robots-tag'), 'index, follow');
      assert.equal(document.querySelector('h1').textContent, data.ui.categoryTitles[i]);
      assert.equal(document.querySelector('link[rel="canonical"]').href, origin + path);
      assert.equal(document.querySelectorAll('link[hreflang]').length, 25);
      assert.equal(document.querySelectorAll('.collection-intro li').length, 3);
      assert.equal(document.querySelector('.collection-intro .text-link').getAttribute('href'), localized(lang, '/articles/' + newSlugs[i] + '/'));
      assert.equal(document.querySelectorAll('.product-card').length, 0, 'unavailable products are not invented');
      const query = await render(path + '?source=%2Fother-stuff%2F');
      assert.equal(query.response.headers.get('x-robots-tag'), 'noindex, follow');
      assert.equal(query.document.querySelector('link[rel="canonical"]').href, origin + path);
    }
    for (const slug of newSlugs) {
      const page = await render(localized(lang, '/articles/' + slug + '/'));
      const model = data.articles.find(a => a.slug === slug);
      assert.equal(page.document.querySelector('.article-lead').textContent, model.intro);
      assert.equal(page.document.querySelectorAll('.quick-answer li').length, 3);
      assert.equal(page.document.querySelector('.article-heading time').getAttribute('datetime'), '2026-10-21');
      const schema = [...page.document.querySelectorAll('script[type="application/ld+json"]')].map(el => JSON.parse(el.textContent)).find(s => s['@type'] === 'Article');
      assert.equal(schema.datePublished, '2026-10-21');
      assert.equal(schema.inLanguage, lang);
      if (lang === 'de' && slug === newSlugs[0]) analyticsPage = page;
    }
  }
  // A fresh real catalog snapshot still renders the correct collection and source item ID.
  const now = Date.now();
  const entries = new Map();
  for (const path of ['/shoes/', '/hoodies-sweaters/']) {
    const html = `<article class="product-card"><a class="product-image" href="${path}verified-item-123.html"><img src="${source}/photo.jpg"></a><h3 class="product-name">Verified ${path}</h3><div class="product-price">126</div><button data-cart-weidian="1234567890"></button></article><a class="filter-btn active" href="${path}"></a>`;
    entries.set(sourceCacheKey(source + path).key, { resource: path, value: html, at: now, expiresAt: now + 86400000 });
  }
  const kv = { get: async key => entries.get(key) || null, put: async (key, value) => entries.set(key, JSON.parse(value)) };
  for (const [name, root] of [['shoes','/shoes/'],['hoodies','/hoodies-sweaters/']]) {
    const { response, document } = await render('/categories/' + name + '/', { SOURCE_CACHE: kv });
    assert.equal(response.status, 200);
    assert.equal(document.querySelector('.product-card h3').textContent, 'Verified ' + root);
    assert.equal(document.querySelector('.category-options .selected').getAttribute('href'), '/categories/' + name + '/');
  }
  const missing = await render('/categories/not-a-category/');
  assert.equal(missing.response.status, 404);
  assert.equal(missing.response.headers.get('x-robots-tag'), 'noindex, follow');
  // Execute the actual rendered analytics code without network requests or real analytics writes.
  const { document, window } = analyticsPage;
  const context = { document, Element: window.Element, URL, location: new URL(origin + '/de/articles/pikobuy-sneaker-finds/') };
  context.window = context;
  for (const script of document.querySelectorAll('script')) {
    if (script.textContent.includes('gtag(')) runInNewContext(script.textContent, context);
  }
  const click = link => link.dispatchEvent(new window.Event('click', { bubbles: true }));
  click(document.querySelector('.quick-answer a'));
  click(document.querySelector('#primary-nav a'));
  click(document.querySelector('[data-track="registration_click"]'));
  const buy = document.createElement('a');
  buy.href = 'https://www.pikobuy.com/product/detail?productUrl=private-test';
  buy.setAttribute('data-track','purchase_click');buy.setAttribute('data-item-id','1234567890');
  document.body.appendChild(buy);click(buy);
  const events = Array.from(context.dataLayer, args => Array.from(args)).filter(args => args[0] === 'event');
  assert.deepEqual(events.map(args => args[1]), ['article_catalog_click','article_catalog_click','registration_click','purchase_click']);
  assert.ok(events.every(([, , p]) => p.page_language === 'de' && !JSON.stringify(p).includes('?') && !JSON.stringify(p).includes('private-test')));
  assert.equal(events.at(-1)[2].item_id, '1234567890');
  console.log('PASS: 24 localized homepages, 48 indexable categories under source429, 72 complete new articles, real catalog recovery, dates/hreflang/canonicals, query/404 noindex and four actual click paths without query leakage.');
} finally { globalThis.fetch = originalFetch; }
