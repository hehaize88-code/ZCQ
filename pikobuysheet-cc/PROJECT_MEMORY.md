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
- Sitemap contains 360 core/editorial URLs (24 languages × 15 pages), with language alternatives.
- www redirects to apex with 301, retaining path and query.
- Official assets are served from public/brand; no product image assets are stored here.
- Earlier preview research/validation files are historical. Production deployment verification will be recorded separately.

## Known follow-up work

- Improve the resolution of the official logo when the source asset becomes accessible.
- Native-language review of all 24 languages.
- Connect image search and QC only when real findspreadsheet endpoints are available.
