# Yukino IP

网页入口为 `https://ip.yukino.bond/` 与主站 `/ip`，复用 raptor Pages 项目、现有部署流程与纸白／鼠尾草配色。本功能不制作 Windows 安装包。

## 连接信息

`GET /api/ip/visitor` 读取 Cloudflare 的 `CF-Connecting-IP`、`request.cf.asn` 和 `asOrganization`，不会查询服务器的出口地址，也不会信任客户端提供的 `X-Forwarded-For`。IPv4 / IPv6 标准化后显示，缺少可信公网连接信息时明确显示未提供。本接口始终 `private, no-store`，前端 Service Worker 跳过 `/api/`；首页和页脚只在同一个浏览器会话内合并请求。

## 查询来源

`POST /api/ip/check` 接受 `{"ip":"公网地址"}`，不接受域名、URL、CIDR、内网、保留地址或批量输入。请求限制 1 KB，上游请求独立超时 8 秒、响应不超过 500 KB，来源失败不阻塞其余结果。限频为每个边缘进程中每访问者每分钟 12 次，另受提供方额度限制，不声称全网严格限频。

| 来源 | 用途 | 接口 / 官方依据 | 缓存 |
| --- | --- | --- | --- |
| IPQuery | 原始风险 0–100、VPN / 代理 / Tor / 机房 | [官方文档](https://ipquery.io/) | 10 分钟 |
| proxycheck.io v3 | 原始风险 0–100、匿名网络与网络资料 | [官方文档](https://proxycheck.io/api/) | 10 分钟 |
| IPWHOIS.io | ASN、组织、国家城市；免费接口没有安全字段 | [官方文档](https://ipwhois.io/documentation) | 10 分钟 |
| Tor Project | 官方 IPv4 出口名单精确匹配 | [公开名单](https://check.torproject.org/torbulkexitlist) | 10 分钟 |
| Spamhaus DROP | IPv4 / IPv6 CIDR 恶意网段匹配 | [数据与使用说明](https://www.spamhaus.org/blocklists/do-not-route-or-peer/) | 1 小时 |
| abuse.ch Feodo Tracker | 近期恶意 C2 IP 精确匹配，超过 30 天的记录不采纳 | [推荐名单与 CC0 说明](https://feodotracker.abuse.ch/blocklist/) | 5 分钟 |

默认无需密钥。proxycheck 无密钥额度为查询出口每日 100 次，达到额度时显示受限，不伪造结果；可选 Pages secret `PROXYCHECK_API_KEY` 提升已获授权账户的额度，密钥始终在服务端。未配置其他收费 API，不抓取需登录、付费或未授权的页面。

公开名单存在于 D1 自动创建的 `ip_public_feeds` 表中，不包含访客身份或查询历史。该表用共享刷新租约控制全站取数频率，尤其 DROP 最多每小时请求一次，保留原始日期与版权字段。单 IP 风险结果仅使用有上限的进程缓存。API 响应不供浏览器或 CDN 共享缓存。

## 模型 v1

先对成功返回的两家原始风险分数取等权平均（四舍五入），然后取该平均与已检出标记风险下限的最大值。纯净度 = 100 − 综合风险。

| 标记 | 综合风险下限 |
| --- | --- |
| 机房 / 托管 | 20 |
| VPN / 匿名网络 | 35 |
| 公开代理 | 50 |
| Tor 出口 | 70 |
| 被入侵记录 | 80 |
| 近期恶意 C2 / DROP | 95 |

同类标记只计算一次，多个下限取最大值。位置与 ASN 分歧不扣分，单项名单未命中不加入风险平均；失败、缺失、IPv6 不支持的名单不视为安全。两家风险数据库都失败时不生成分数，即使所有名单未命中也不显示 100 分。来源风险相差至少 40 分、布尔标记相矛盾或存在不可用来源时提示资料有限和交叉核对。

这是本站的启发式综合指标，不是统计概率、个人信誉评分、金融风控决定或网站放行保证。代理和托管本身不是恶意行为。结果应结合各来源记录日期判断，查询时明确说明目标 IP 会发送至风险和网络资料提供方。

Spamhaus 数据使用保留 `© The Spamhaus Project SLU`、数据时间及来源链接；未替换其版权或将本站分数当作提供方原始分数。

## AI 网站访问风险

IP 页面复用本次查询资料，新增 ChatGPT、Claude、Gemini、Microsoft Copilot、Perplexity 和 Grok 提示。此功能不向 AI 网站发送目标 IP、不测试账号或登录，不添加上游查询，不生成封禁概率，也不声称知道平台内部风险阈值。判断对象为 `report.ip`，不会用当前访问者的国家代替手动查询目标的资料。

网络风险使用本站启发式规则：综合风险至少 60，或已有 Tor、被入侵、近期 C2、DROP 标记时显示较高风险；综合风险至少 25，或已有 VPN、公开代理、匿名网络、机房标记时提示存在验证风险。只有至少两家有效风险分数、无评分或标记分歧、关键标记 VPN／公开代理／Tor／机房均有覆盖时，才能给出较低网络风险。资料缺失不能当成安全；即使纯净度因无完整分数而留空，已命中的名单仍保留风险提示。各平台共用网络规则，不编造各站权重。

地区资格单独检查成功来源返回的国家代码或可识别国家名，并保留出处。来源间或同一来源的国家名／代码有冲突时不选取其中一个。国家位置不能证明实际居住地，支持名单内也不保证账号、功能或所有子地区可用。没有完整地区名单时保持未知；明确地区例外会显示较高地区访问风险，不改动原有纯净度分数。

以下来源于 2026-10-11 核对；`src/data/ai-access-policies.ts` 保存消费网页范围的地区快照和公开依据，页面显示核对日期。公开规则变更需重新核对更新，不会将快照冒充实时平台查询。

| 平台 | 官方依据 | 范围与例外 |
| --- | --- | --- |
| ChatGPT | [网页地区名单](https://help.openai.com/en/articles/7947663-chatgpt-supported-countries)、[异常活动说明](https://help.openai.com/en/articles/10471992-why-am-i-receiving-a-suspicious-activity-alert) | 网页个人账号，国家级信息不能判断乌克兰的子地区例外 |
| Claude | [消费者地区名单](https://support.claude.com/en/articles/8461763-where-can-i-access-claude)、[IP 与位置用途](https://privacy.claude.com/en/articles/11186740-does-claude-use-my-location) | 乌克兰子地区与名单中含糊的 Mariana Islands 保留待核对，不将后者扩写为肯定准入 |
| Gemini | [网页地区名单](https://support.google.com/gemini/answer/13575153?hl=en)、[账号资格](https://support.google.com/gemini/answer/13278668?hl=en) | 按个人账号判断，中国大陆仅列为 Workspace 可用；[Google 搜索共享网络说明](https://support.google.com/websearch/answer/86640?hl=en) 仅作参考，不冒充 Gemini 风控阈值 |
| Copilot | [地区和语言说明](https://support.microsoft.com/en-us/microsoft-365-copilot/supported-languages-for-microsoft-365-copilot) | 仅自动标注明确的中国大陆例外，香港不套用该排除项；其他市场和功能保持待核对 |
| Perplexity | [账号管理与 VPN 说明](https://www.perplexity.ai/help-center/en/articles/10352998-account-management-and-security) | VPN 与 Cloudflare 验证有公开排查依据，未核实完整地区名单 |
| Grok | [X 内入口说明](https://help.x.com/en/using-x/about-grok)、[独立站条款](https://x.ai/legal/terms-of-service) | 不将 X 内入口的地区说明当作 grok.com 的完整支持名单 |
