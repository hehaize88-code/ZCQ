# Pikobuy Sheet — pikobuysheet.cc

Independent Pikobuy spreadsheet and editorial site, built with Astro SSR and deployed to Cloudflare Workers. This directory is the deployment root; other domains in ZCQ must use separate directories.

## Development and build

Node 24 is required. Install with `npm ci`, build with `npm run build`, and deploy with `npm run deploy` using an authorized Cloudflare session. No credentials belong in this repository.

Cloudflare Workers Builds settings:

- Worker: `pikobuysheet-cc`
- Repository: `hehaize88-code/ZCQ`, branch `main`
- Root directory: `pikobuysheet-cc`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Node version: 24 (also specified in `.node-version`)
- Watch paths: `pikobuysheet-cc/**`; exclude `pikobuysheet-cc/docs/**` and `pikobuysheet-cc/*.md`
- Custom domains: `pikobuysheet.cc` and `www.pikobuysheet.cc` (301 to apex)

## Data and editorial content

All live product data, images, search, sorting, details, SKU and QC requests come from `https://findspreadsheet.com`. No catalog database, copied catalog, generated product images, or administration backend is created. Registration and purchase take place on official Pikobuy. Purchase URLs use the original Weidian item ID.

Editorial JSON contains 28 FAQs, a guide and 10 researched articles in 24 languages. The build validates completeness before packing this original editorial content. Source and keyword research is documented under `docs/research/`.

QC availability depends on the upstream source; image search is not connected. Both are presented honestly. Product titles and source SKU values remain in their upstream language. Translations have not all received native-language editorial review.

## SEO

Only the apex production hostname permits indexing. Error pages, image-search status pages and query variants are noindex. Canonical and hreflang URLs consistently point to the production domain. `/sitemap.xml` lists 360 editorial/core URLs in 24 languages; product pages are discovered through live catalog links rather than a copied product store. Non-production hosts keep noindex and a blocking robots.txt.

The independent preview Worker is maintained separately and is not modified by this production configuration.

Live check note (2026-10-18): deployment and SEO routes are live. The upstream site returned HTTP429 to Cloudflare during search/detail checks; the UI reports temporary unavailability. This limitation also affected the original preview.

Production resilience: the `SOURCE_CACHE` KV binding stores at most 90 expiring public response projections. Only the main catalog may fall back to a verified snapshot up to 24 hours old during transient failures; other resources keep their existing bounds. A ten-minute scheduled refresh respects source backoff. No searches, source sessions, SKU/QC data, or images are stored.
