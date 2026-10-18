# Implemented editorial map — 17 October 2026

This is the final route map for this preview and supersedes the proposed slugs in the research brief. The homepage retains the primary target `pikobuy spreadsheet`. These targets reflect observed search results and competitor page topics, not measured search volume, difficulty, traffic or rankings.

| Page | Search intent | Route |
| --- | --- | --- |
| FAQ (28 questions) | Pikobuy FAQ, account/order/warehouse/parcel questions | `/faq/` |
| Article collection | Pikobuy guides | `/articles/` |
| How to Use a Pikobuy Spreadsheet: Search, Compare and Build a Useful Shortlist | pikobuy spreadsheet guide; pikobuy finds | `/articles/how-to-use-pikobuy-spreadsheet/` |
| Pikobuy Ordering Guide: From Your First Product Link to Parcel Submission | how to use pikobuy; how to buy on pikobuy | `/articles/pikobuy-ordering-guide/` |
| Pikobuy Weidian Links: Keep the Correct Product ID from Discovery to Order | pikobuy weidian links; pikobuy link not working | `/articles/pikobuy-weidian-links/` |
| Pikobuy QC Photo Guide: Read Warehouse Evidence Without Overclaiming | pikobuy qc photos; pikobuy quality check | `/articles/pikobuy-qc-photo-guide/` |
| Pikobuy Sizing Guide: Compare Measurements Before Choosing Clothes or Shoes | pikobuy size guide; pikobuy size chart | `/articles/pikobuy-sizing-guide/` |
| Pikobuy Shipping Cost: Build a Useful Estimate Before You Buy | pikobuy shipping cost; pikobuy shipping calculator | `/articles/pikobuy-shipping-cost/` |
| Pikobuy Parcel Packing: Compare Consolidation and Protection | pikobuy parcel; pikobuy packaging; pikobuy consolidation | `/articles/pikobuy-parcel-packing/` |
| Pikobuy Returns and Refunds: Prepare a Warehouse Decision | pikobuy return policy; pikobuy refund; pikobuy 120 hours | `/articles/pikobuy-returns-refunds/` |
| Pikobuy Tracking: Identify the Stage and Record the Evidence | pikobuy tracking; pikobuy tracking not updating | `/articles/pikobuy-tracking-guide/` |
| Pikobuy Review Checklist: Evaluate the Evidence Before Paying | pikobuy review; is pikobuy legit; is pikobuy safe | `/articles/pikobuy-review-checklist/` |

The tenth article is an evidence-based review checklist rather than an image-search tutorial. Supplemental root research observed review/safety targeting at https://pikobuyspread.com/review/ and https://pikobuy.org/buyer-safety.html on 17 October 2026. No competitor score, traffic figure, testimonial, claimed test order or conclusion was adopted. Image search remains honestly described as unconnected in the FAQ.

Only `/guide/`, `/faq/`, `/articles/` and the ten article routes are created for this request. QC and shipping are covered in their respective articles; proposed standalone `/qc/` and `/shipping/` routes were not added.

## Editorial and implementation rules

- Full articles use coherent sections, practical examples and brief official factual anchors. FAQ answers are a separate format.
- Official URLs are linked on answers and in each article's source panel; site-feature answers refer to actual implemented behavior.
- Return eligibility, 120-hour application timing and possible charges are not presented as guaranteed free returns. The original-freight wording conflict remains explicit.
- No universal freight rate, delivery time, volumetric divisor, payment-method availability or free QC/storage allowance is asserted.
- Official three-day guidance concerns tracking availability after dispatch, not delivery.
- Current preview is noindex in HTML, response headers and robots.txt. Canonical/hreflang use the active preview origin; production-domain SEO activation is a later authorized action.
- 24 locale source files must each contain the same 28 FAQs, six guide stages and ten complete articles. Locale switches preserve page and query context. English fallback is prohibited for editorial pages.
- Article/CollectionPage, BreadcrumbList and FAQPage data describe actual visible content; no rating schema or rich-result promise.
- All commercial product and image data stays on FindSpreadsheet; editorial assets contain no copied catalog, product image set or database.

Production note (2026-10-18): formal deployment now uses the fixed https://pikobuysheet.cc origin. Production indexing and the multilingual sitemap are configured in source; preview hosts remain noindex.
