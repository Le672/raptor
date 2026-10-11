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
