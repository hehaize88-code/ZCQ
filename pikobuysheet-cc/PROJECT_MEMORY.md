# Pikobuy Sheet project memory

Updated: 2026-10-21

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
- Primary sitemap: /sitemap-main.xml, a complete compact XML document generated at build time and returned directly by the Worker entrypoint before Astro rendering, with explicit GET/HEAD behavior. Covers 360 core/editorial URLs (24 languages × 15 pages). robots.txt advertises this address. Language alternatives remain in each HTML page. /sitemap.txt, /sitemap-index.xml, /sitemap-pages.xml and the original /sitemap.xml remain available with the same URL set.
- 2026-10-18: GSC live inspection fetched /sitemap-pages.xml at 10:14:30 Asia/Shanghai with HTTP200 and the complete XML, but the Sitemaps report still showed Couldn't fetch/0 discovered. The user removed the report entry and requested another address at 10:21; /sitemap-index.xml was added for manual submission. Do not claim sitemap processing or indexing success without a successful GSC report.
- 2026-10-18 10:27 Asia/Shanghai: the user reported the same GSC error for the index and requested another check and change. Added /sitemap.txt to test Google's supported plain-text format. Changing format is diagnostic; the underlying GSC failure is not confirmed fixed.
- 2026-10-18 10:36 Asia/Shanghai: user reported the same generic error for /sitemap.txt and removed the submitted report entries. Their pasted 360 URLs exactly matched production. GSC Crawl Stats showed 39 requests, 77% HTTP200 and 23% HTTP301, average 108ms; host status reported no issues for robots, DNS or server connectivity. HTTPS robots had been fetched at 09:44 and HTTP robots at 10:22. Google public DNS resolved A/AAAA/NS successfully; HTTP/1.1 Googlebot-UA and compressed requests returned the full text sitemap. Added /sitemap-main.xml as a controlled test independent of Astro page rendering. These checks do not establish a root cause or GSC processing success.
- Direct sitemap deployment: commit dd71531b802553d82581603b02620267156860fd; successful Cloudflare build 9680818c-f12e-4448-a3f9-5cf99e40ab70; Worker version f20fd726-6278-4e5f-8099-1fc471631330. Live XML was HTTP200/application-xml, 27,377 bytes, exactly equal to the validated build and the existing compact XML. Local HEAD, preview noindex, www redirect and an existing HTML route passed.
- At 10:45:02 Asia/Shanghai GSC live inspection of /sitemap-main.xml succeeded (crawl allowed Yes, page fetch Successful). Google-returned source showed the XML declaration and root, URL lines 3–362 and closing root at line 363. The HTTP details showed application/xml and 200 OK. Cloudflare real-time logs confirmed Google-InspectionTool from 66.249.65.172 received HTTP200, outcome ok, wallTime 1ms, no exceptions. The report's saved HTTPS robots was Allow:/ with the original sitemap.xml; requested a robots recrawl successfully.
- Submitted /sitemap-main.xml to the existing domain property, but its Sitemaps report still immediately showed Unknown/Couldn't fetch/0 discovered. Added https://pikobuysheet.cc/ as a URL-prefix property for comparison; ownership auto-verified from the existing domain verification, and the same sitemap entry/error was already visible there without another submission. No evidence that changing property resolves it. Do not describe this as fixed, indexed, or definitively caused by delay/low crawl demand. Keep the submitted map stable; repeated names/formats have not resolved the generic background processing failure.
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


## Connectivity recheck, 2026-10-20

- Responding to the user's report that the site could not connect. The supplied screenshot could not be recovered from its attachment path; the affected URL/error screen is therefore not yet identified.
- Independent current HTTP checks: apex homepage 200, FAQ 200, www/faq/ 301 to the apex FAQ, production workers.dev FAQ 200. Google public DNS returned Status0 and two A records for the apex.
- One search request for socks returned503 with the honest source-unavailable message. The known Orb Graphic Crew Socks detail returned200. Do not conflate this search failure with an inability to connect to the entire domain, or assume all commerce routes are failing.
- No root cause for the user's specific connection error is established. Current Cloudflare connector did not complete; the browser connector reported that the originating connected browser context was unavailable. A fresh screenshot containing the URL or the exact URL/error code is needed to match the user's failure.
- No DNS, TLS, security rule, application source, existing cache binding, or sitemap configuration was changed during this check.

## Crawl discovery repair, 2026-10-21

- User reports Cloudflare cannot connect; do not require another Cloudflare connection. GitHub main still drives the previously authorized automatic deployment.
- Verified GSC homepage, /articles/ and /spreadsheet/ are already indexed. GSC live test of /sitemap-main.xml fetched successfully at 11:06:23 Asia/Shanghai, but the Sitemaps report still says Could not fetch, Unknown, zero URLs. No root cause has been established; a successful live test is not successful sitemap processing.
- GSC robots report read the current Allow:/ plus sitemap-main.xml and sitemap.txt at 10:33. Crawl stats showed no host/DNS/robots outage; the visible 404 example was favicon.ico.
- All six crawler endpoints now build as static assets with static-v2 delivery headers, including legacy XML aliases and the index. Keep /sitemap-main.xml as the primary stable submission URL.
- Added 24 prerendered HTML directories at /sitemap/ and localized equivalents, with localized footer links throughout existing pages. Each directory links the existing five core pages, ten full articles, and all language directories through real HTML anchors. Compact mobile layout keeps the language list collapsible.
- XML and plain text maps now include 384 canonical URLs: all existing 360 plus the 24 directories. No existing content or languages removed. Directory rendering and crawler files are independent of runtime product-source availability.
- Build plus production semantics, simulated upstream429, and static directory/XML agreement checks passed locally. The production verification script now writes dated output under .generated instead of overwriting the historical deployment report.
- Deployed via GitHub commit 7cf861fe85a6a57c9c81404070302e02ba83c196 and existing automatic build d239b0fa-f7c9-460b-b97a-36ad619f5323. Live main XML returned HTTP200, static-v2, 28,814 bytes and all 384 URLs. Legacy XML/text/robots endpoints also returned HTTP200/static-v2. English/German directories and the article footer directory link are live; workers.dev directory correctly returns X-Robots-Tag:noindex. Desktop and 390px mobile visual checks passed.
- Resubmitted the same sitemap-main.xml once after deployment. GSC confirmed submission accepted, but the table still showed Unknown/Could not fetch/0 discovered. The background sitemap processing issue remains unresolved; do not describe it as fixed or merely a confirmed delay.
- Requested indexing of the newly deployed /sitemap/ directory. GSC confirmed it was added to the priority crawl queue. This is acceptance of a crawl request, not confirmation that the directory or all linked pages are indexed.
