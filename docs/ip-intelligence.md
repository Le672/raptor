# Yukino IP

网页入口为 `https://ip.yukino.bond/` 与主站 `/ip`，复用 raptor Pages 项目、现有部署流程与纸白／鼠尾草配色。本功能不制作 Windows 安装包。

## 连接信息

`GET /api/ip/visitor` 读取 Cloudflare 的 `CF-Connecting-IP`、`request.cf.asn` 和 `asOrganization`，不会查询服务器的出口地址，也不会信任客户端提供的 `X-Forwarded-For`。IPv4 / IPv6 标准化后显示，缺少可信公网连接信息时明确显示未提供。本接口始终 `private, no-store`，前端 Service Worker 跳过 `/api/`；首页和页脚只在同一个浏览器会话内合并请求。

## 查询来源

`POST /api/ip/check` 接受 `{"ip":"公网地址"}`，不接受域名、URL、CIDR、内网、保留地址或批量输入。请求限制 1 KB，上游请求独立超时 8 秒，通常响应不超过 500 KB；IPsum 完整文件允许 3 MB，但解析验证后只保存至少 3 份名单共同收录的记录与原始日期，避免超过 D1 单行限制。请求使用 Workers 支持的 `redirect: manual`，意外跳转不跟随。前端查询等待最多 20 秒。来源失败不阻塞其余结果。限频为每个边缘进程中每访问者每分钟 12 次，另受提供方额度限制，不声称全网严格限频。

| 来源 | 用途 | 接口 / 官方依据 | 缓存 |
| --- | --- | --- | --- |
| IPQuery | 原始风险 0–100、VPN / 代理 / Tor / 机房 | [官方文档](https://ipquery.io/) | 10 分钟 |
| proxycheck.io v3 | 原始风险 0–100、匿名网络与网络资料 | [官方文档](https://proxycheck.io/api/) | 10 分钟 |
| IPWHOIS.io | ASN、组织、国家城市；免费接口没有安全字段 | [官方文档](https://ipwhois.io/documentation) | 10 分钟 |
| ipapi.is | 匿名接口仅提供位置与网络资料，授权接口可增加安全标记 | [官方文档](https://ipapi.is/developers.html) | 10 分钟 |
| IP Guide | ASN、网络范围与 IP 位置，ASN 注册国不当作出口位置 | [官方接口](https://ip.guide/) | 10 分钟 |
| ipapi.co | ASN、组织与地理位置，不提供安全分数 | [官方文档](https://ipapi.co/api/) | 10 分钟 |
| Tor Project | 官方 IPv4 出口名单精确匹配 | [公开名单](https://check.torproject.org/torbulkexitlist) | 10 分钟 |
| Spamhaus DROP | IPv4 / IPv6 CIDR 恶意网段匹配 | [数据与使用说明](https://www.spamhaus.org/blocklists/do-not-route-or-peer/) | 1 小时 |
| abuse.ch Feodo Tracker | 近期恶意 C2 IP 精确匹配，超过 30 天的记录不采纳 | [推荐名单与 CC0 说明](https://feodotracker.abuse.ch/blocklist/) | 5 分钟 |
| SANS ISC / DShield | 推荐列表中的近期扫描活跃 /24 网段；不能归因于每个用户 | [名单与使用说明](https://www.dshield.org/feeds_doc.html) | 1 小时 |
| CINS Army | Sentinel IPS 公开威胁 IPv4 地址名单 | [提供方说明](https://cinsscore.com/) | 1 小时 |
| IPsum | 至少三份名单收录的 IPv4 地址；聚合数据可能与其他来源重叠 | [原始项目与 Unlicense](https://github.com/stamparm/ipsum) | 1 小时 |
| IPQualityScore（可选） | 授权 API 的 fraud_score 与匿名网络标记 | [官方文档](https://www.ipqualityscore.com/documentation/proxy-detection-api/overview) | 10 分钟 |
| AbuseIPDB（可选） | 30 天滥用置信分和报告数，不混入广义风险平均 | [官方文档](https://docs.abuseipdb.com/) | 10 分钟 |
| IPinfo Lite（可选） | 授权接口的国家与 ASN，无安全分数 | [官方文档](https://ipinfo.io/developers) | 10 分钟 |

默认启用 12 个无需密钥的公开来源，实际可用数以本次响应为准。ipapi.is 自 2026-09 起匿名接口为每日 100 次的最简位置资料，没有安全字段；不把缺少的 VPN、代理字段补成 false，也不把网段 abuser_score 转成单个 IP 欺诈评分。免费或公开不表示无限额。429 的 Retry-After 在进程和共享 D1 `ip_source_backoff` 表中保存，跨目标查询也不会立即重试；没有 Retry-After 时至少等待一小时。

可以使用已有授权设置 Pages 服务端 secret：`PROXYCHECK_API_KEY`、`IPAPI_IS_API_KEY`、`IPQS_API_KEY`、`ABUSEIPDB_API_KEY`、`IPINFO_TOKEN`。缺少凭据的三个可选来源返回 `not-configured`，不发送请求、不计入来源总数和完整度，不声称其已被启用。密钥不进入前端、响应、共享名单表或日志。授权 API 仅查询，不提交滥用报告或创建账户。

页面另列出 Scamalytics、IPQualityScore、AbuseIPDB、IPinfo、IP2Location、IP2Proxy、IPHub、VirusTotal、Cisco Talos、MXToolbox 十个手动复核入口，能带入地址的链接使用标准化后的目标 IP，其余提供复制按钮。点击才由用户打开对应网站，不抓取其网页，不将外部页面或邮件黑名单结果伪装成本次自动评分。

公开名单存在于 D1 自动创建的 `ip_public_feeds` 表中，不包含访客身份或查询历史。该表用共享刷新租约控制全站取数频率，尤其 DROP 最多每小时请求一次，保留原始日期与版权字段。单 IP 风险结果仅使用有上限的进程缓存。API 响应不供浏览器或 CDN 共享缓存。

## 模型 v2

先对成功返回的广义风险分数取等权平均（四舍五入）：默认 IPQuery、proxycheck，可选授权 IPQualityScore。AbuseIPDB 的 abuseConfidenceScore 是滥用专项分数，不参与平均；仅在分数 ≥50 且有报告时触发本站滥用标记。然后取平均与已检出标记风险下限的最大值。纯净度 = 100 − 综合风险。

| 标记 | 综合风险下限 |
| --- | --- |
| 机房 / 托管 | 20 |
| VPN / 匿名网络 | 35 |
| 公开代理 | 50 |
| Tor 出口 | 70 |
| 滥用 / 扫描记录 | 70 |
| 被入侵记录 | 80 |
| 近期恶意 C2 / DROP | 95 |

同类标记只计算一次，多个下限取最大值。位置与 ASN 分歧不扣分，单项名单未命中不加入风险平均；失败、缺失、IPv6 不支持的名单不视为安全。没有有效广义风险分数时不生成分数，即使所有名单未命中也不显示 100 分。来源风险相差至少 40 分、相同网络属性相矛盾或存在不可用来源时提示资料有限。滥用来源的事件窗口与范围不同，一家命中、另一家未命中不视为同一判断的矛盾。CINS 使用 Last-Modified，DShield 与 IPsum 使用文件内日期；缺失、异常或超过三天不生成“未命中”。

这是本站的启发式综合指标，不是统计概率、个人信誉评分、金融风控决定或网站放行保证。代理和托管本身不是恶意行为。结果应结合各来源记录日期判断，查询时明确说明目标 IP 会发送至风险和网络资料提供方。

Spamhaus 数据使用保留 `© The Spamhaus Project SLU`、数据时间及来源链接；未替换其版权或将本站分数当作提供方原始分数。DShield 标注 SANS Technology Institute、Internet Storm Center 与原始链接，遵循 CC BY-NC-SA 2.5 条件；CINS 与 IPsum 分别保留提供方和许可信息。

## AI 网站访问风险

IP 页面复用本次查询资料，分析 ChatGPT、Claude、Gemini、Microsoft Copilot、Perplexity、Grok、DeepSeek、Qwen Chat、Mistral Le Chat 和 Poe 十个网页入口。此功能不向 AI 网站发送目标 IP、不测试账号或登录，不添加平台探测，不生成封禁概率，也不声称知道内部风险阈值。判断对象为 `report.ip`，不会用当前访问者的国家代替手动查询目标的资料。

网络风险使用本站启发式规则：综合风险至少 60，或已有 Tor、被入侵、近期 C2、DROP、滥用 / 扫描标记时显示较高风险；综合风险至少 25，或已有 VPN、公开代理、匿名网络、机房标记时提示验证风险。只有至少两家有效风险分数、无评分或标记分歧、关键标记 VPN／公开代理／Tor／机房均有覆盖时，才能给出较低网络风险。资料缺失不能当成安全；已命中的名单始终保留提示。各平台共用网络规则，不编造各站权重。另展示原始风险、匿名出口、威胁记录、位置一致性四项证据及出处，即使网络风险较低，威胁名单的部分覆盖仍会明确显示未知。

每个服务分别显示本站推断、官方地区状态、未检测的账号资格与功能额度，展开后显示该服务的官方说明、常见提示与排查顺序。保留地区风险和网络风险并存，来源位置分歧时不输出肯定准入结论。网络或数据筛选、展开卡片只更新视图，不再查询上游。

地区资格单独检查成功来源返回的国家代码或可识别国家名，并保留出处。来源间或同一来源的国家名／代码有冲突时不选取其中一个。国家位置不能证明实际居住地，支持名单内也不保证账号、功能或所有子地区可用。没有完整地区名单时保持未知；明确地区例外会显示较高地区访问风险，不改动原有纯净度分数。

地区快照核对于 2026-10-11，详细说明核对于 2026-10-12；两种日期分别保留。`src/data/ai-access-policies.ts` 保存网页范围与公开依据，规则变更需重新核对，不会将快照冒充实时平台查询。

| 平台 | 官方依据 | 范围与例外 |
| --- | --- | --- |
| ChatGPT | [网页地区名单](https://help.openai.com/en/articles/7947663-chatgpt-supported-countries)、[异常活动说明](https://help.openai.com/en/articles/10471992-why-am-i-receiving-a-suspicious-activity-alert) | 网页个人账号，国家级信息不能判断乌克兰的子地区例外 |
| Claude | [消费者地区名单](https://support.claude.com/en/articles/8461763-where-can-i-access-claude)、[IP 与位置用途](https://privacy.claude.com/en/articles/11186740-does-claude-use-my-location) | 乌克兰子地区与名单中含糊的 Mariana Islands 保留待核对，不将后者扩写为肯定准入 |
| Gemini | [网页地区名单](https://support.google.com/gemini/answer/13575153?hl=en)、[账号资格](https://support.google.com/gemini/answer/13278668?hl=en) | 按个人账号判断，中国大陆仅列为 Workspace 可用；[Google 搜索共享网络说明](https://support.google.com/websearch/answer/86640?hl=en) 仅作参考，不冒充 Gemini 风控阈值 |
| Copilot | [个人入口地区和语言说明](https://support.microsoft.com/en-au/microsoft-copilot/supported-regions-and-languages-in-microsoft-copilot) | 仅自动标注明确的中国大陆例外，香港不套用该排除项；其他市场和功能保持待核对 |
| Perplexity | [账号管理与 VPN 说明](https://www.perplexity.ai/help-center/en/articles/10352998-account-management-and-security) | VPN 与 Cloudflare 验证有公开排查依据，未核实完整地区名单 |
| Grok | [X 内入口说明](https://help.x.com/en/using-x/about-grok)、[独立站条款](https://x.ai/legal/terms-of-service) | 不将 X 内入口的地区说明当作 grok.com 的完整支持名单 |
| DeepSeek | [账号与服务条款](https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html) | 注册资料、验证与网页 / API 范围分别核对，完整地区范围未知 |
| Qwen Chat | [Chat 使用政策](https://chat.qwen.ai/legal-agreement/usage-policy)、[Studio 范围](https://qwen.ai/termsservice) | 入口与条款范围分开，不将 Studio 条件套用于 Chat |
| Mistral Le Chat | [年龄资格](https://help.mistral.ai/en/articles/347631-can-children-use-mistral-products-and-services)、[功能帮助](https://help.mistral.ai/en/collections/701669-le-chat) | 账号年龄、套餐与用量分别核对，不按纯净度认定资格 |
| Poe | [机器人与点数](https://help.poe.com/hc/en-us/articles/19944206309524-Poe-FAQs)、[套餐帮助](https://help.poe.com/hc/en-us/articles/19945140063636-Poe-Purchases-FAQs) | 聚合入口不是原模型平台网页；点数、上下文与机器人限制不等于 IP 封禁 |
