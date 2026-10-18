# Pikobuy Sheet project memory

Updated: 2026-10-18

## Scope and persistent decisions

- This project serves only Pikobuy at https://pikobuysheet.cc.
- GitHub destination: hehaize88-code/ZCQ/pikobuysheet-cc. Keep each future domain in its own folder.
- User explicitly authorized formal GitHub and Cloudflare deployment on 2026-10-18, after reviewing the public preview.
- Reuse the confirmed Astro 7.4.0 SSR source, including 24 locales, 28 FAQ entries and 10 complete researched articles.
- All commerce data and product photography must come from findspreadsheet.com. No database or admin backend.
- Use official Pikobuy branding. This is an independent site; retain the independence disclosure.
- Registration: https://www.pikobuy.com/?mode=register&redirect=/home
- Purchase: https://www.pikobuy.com/product/detail?productUrl=<URL-encoded original Weidian URL>. Use the source itemID, never an internal catalog ID.
- FAQ, articles, guide and catalog have separate pages; language switching preserves the same page.
- Official policies and article claims must cite verified sources. Never invent shipping times, costs, reviews or search volume.
- QC upstream is unavailable and image search is not connected. Do not simulate either capability.

## Production implementation

- Cloudflare Worker: pikobuysheet-cc. Build directory: pikobuysheet-cc. Node: 24.
- Main branch deploys using npm run build and npx wrangler deploy.
- apex production hostname is indexable; other hosts are noindex. Error and query pages are noindex.
- Canonical, hreflang and structured-data URLs use https://pikobuysheet.cc.
- Primary sitemap: /sitemap-pages.xml, containing 360 core/editorial URLs (24 languages × 15 pages) as compact standard XML. robots.txt advertises this address. Language alternatives remain in each HTML page. The original /sitemap.xml remains available with its language alternatives; both use the same path generator.
- www redirects to apex with 301, retaining path and query.
- Official assets are served from public/brand; no product image assets are stored here.
- Earlier preview research/validation files are historical. Production deployment verification will be recorded separately.

## Known follow-up work

- Improve the resolution of the official logo when the source asset becomes accessible.
- Native-language review of all 24 languages.
- Connect image search and QC only when real findspreadsheet endpoints are available.

## Deployment completed, 2026-10-18

- GitHub initial production commit: 80566000aa40181ba78f93b3a03a22e23cc855d2. All 60 uploaded files matched local Git blob hashes.
- Cloudflare build d40e8920-4b94-4d27-b66f-1540c29bc4de succeeded. Active Worker version: 822fc7a9-9947-4e49-8f53-781ce7eba173.
- Production custom domains: pikobuysheet.cc and www.pikobuysheet.cc. www returns 301 to apex with path/query preserved.
- Automatic builds follow main and watch pikobuysheet-cc/**, excluding docs/** and root Markdown documentation within this directory, so future sibling projects do not trigger this site.
- Public HTTP checks passed for home, FAQ, articles, German article, robots, sitemap and favicon. Production is indexable; workers.dev remains noindex. Public sitemap contains 360 URLs.
- Browser showed the complete homepage with real source product photos, 24 languages and all primary navigation.
- Important live data limitation: search and product details returned 503 during final checks. Cloudflare's real-time logs identified upstream FindSpreadsheet HTTP429 rate limiting. The original preview search also returned503, while a normal direct source request returned200/60 products. Do not describe search/details as fully verified or change main-site security rules without a separately authorized plan.
- QC and image search retain their existing honest unavailable states. No new data store or admin was created.
