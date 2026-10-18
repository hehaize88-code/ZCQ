# FindSpreadsheet 数据适配（2026-10-17）

唯一来源 https://findspreadsheet.com。运行时只读 HTTP，不创建持久商品数据或图片仓库；最多 90 条短期进程内缓存。同一来源 URL 的并发请求合并；429 遵守 Retry-After（至少退避 60 秒），其他错误至少退避 30 秒。目录/详情成功响应正常缓存 3 分钟，遇到网络错误、429 或 5xx 时最多额外复用 12 分钟；404/403 不使用过期成功响应。SKU/QC 不额外复用过期数据。

- 首页的指南、文章和 FAQ 独立于商品源；推荐商品失败只影响商品模块，首页保留 200 和正常索引。目录/详情没有真实数据时返回 503、Retry-After: 60 和 Cache-Control: no-store，不制造商品或将空错误页伪装为成功。

- 目录 /AllProducts/ 和 11 个主站分类。排序、分页从主站真实导航提取，再严格验证固定路径与参数。
- 文字搜索 /search.html?keywords={query}&channelid=2；搜索排序使用主站实际 index.php Search 链接。
- 详情从实际 category/slug-id.html 读取，禁止任意外部代理。
- 商品图片用主站 HTML 与接口返回的 URL，不复制竞品图片，不生成图片。
- 人民币转美元读取主站 script.js 的 CNY_TO_USD_RATE；如无法读取汇率，价格显示 CNY 原币。没有缓存的价格不能捏造。
- 来源商品 ID 来自 data-cart-weidian；与主站记录 ID 严格区分。
- SKU /api/Goods/getSkuData?weidian_id={id}；规格仅供查看，最后在 Pikobuy 确认选择、价格和库存。
- QC /qcradar-qc.php?item={id}。本轮样本返回 503，展示不可用，不把商品照片标记为 QC。
- 尚未确认可用的主站搜图接口：不接收上传、不返回假搜索结果。
- 出站购买链接保留用户模板语义，内层 Weidian URL 用 URLSearchParams 编码。没有新增邀请码或联盟参数。
- 预览全站 noindex,nofollow，并禁止 robots 抓取。正式 SEO 上线需单独切换 canonical/hreflang/sitemap 与索引策略。
