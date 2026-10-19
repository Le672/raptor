# Yukino Novel · 轻小说书房

独立轻小说网站，正式入口为 https://novel.yukino.bond 。沿用 Yukino 品牌与视觉，导航围绕轻小说书房并提供返回主站入口；使用主站现有 React、Vite 和 lucide-react 依赖，独立 Cloudflare Worker、静态资源和 KV 缓存不依赖主站登录。

## 本地运行

从仓库根目录执行：

```powershell
pnpm install
pnpm novel:dev
```

在 Chrome 打开 http://127.0.0.1:5186 。本地服务通过已配置的 HTTP(S) 代理访问公开书源，缓存保存在忽略的 `.novel-work/local-kv`。生产使用 Cloudflare KV。

```powershell
pnpm novel:test
pnpm novel:build
```

## 数据与更新

| 书源 | 搜索范围 | 目录与阅读 |
| --- | --- | --- |
| 哔哩轻小说 | [lnovel 公开聚合接口](https://github.com/yjl9903/lnovel/blob/main/examples/api.http)已索引的译文书库 | 分卷、正文、插图 |
| 菠萝包 SF | 源站当前返回的公开搜索结果 | 免费章节；VIP 明确标注并链接源站订阅 |
| 轻之文库 | 源站当前返回的公开搜索结果 | 公开作品、分卷与正文 |
| 轻小说文库 | 书籍链接直达、已知公开书目中的本地搜索 | 可访问时读取公开目录与正文；生产实测源站限制 Cloudflare 服务器访问，当前提供源站阅读入口；全站匿名搜索需要登录 |

- 各适配器独立编写，HTML 用 parse5 解析，文库 GBK 页面由 TextDecoder 解码，没有复制第三方解析器代码。页面结构、访问验证和源站状态可能变化，逐源显示失败、受限、旧缓存和最近成功时间。
- 最近更新页汇总各源当前更新列表和已打开书目的公开元数据，**不是四个平台的全部作品**。搜索返回哔哩索引、SF/轻之文库源站第一页公开匹配、已知文库书目，再统一筛选和分页。显示实际返回范围和数量，不写死总书量。
- Cloudflare Cron 每 15 分钟同步更新列表，并对三个新增书源各轮流检查三本已知书目；书架每次最多检查六本新增书源作品，按上次成功获取时间轮换。目录与书目缓存 5 分钟、章节缓存 15 分钟，手动刷新最短 1 分钟。源站发布、翻译与上游缓存决定实际更新速度，不承诺与源站同步秒更。
- 本站同步时间、源站更新时间、上游抓取时间分别保留。失败时保留旧快照并明确显示原因和成功时间；空索引、登录 HTML、错误 JSON 不会覆盖成功快照。
- 共享索引与已知书目保留 30 天、搜索缓存 1 小时、章节共享缓存 7 天。浏览器最近 180 个成功 API 响应缓存可在断网时回退。明确的 400/401/403/404 不使用浏览器缓存正文；新增源章节明确拒绝访问时，服务端也不回退旧正文。Service Worker 缓存应用外壳；插图由普通浏览器 HTTP 缓存决定离线可用性。
- `done` 表示上游整理任务完成，不代表小说完结；连载状态只依据上游明确标签。
- 旧哔哩书号、缓存键和书架 schema 保持兼容。新增书号使用 `sf-`、`linovel-`、`wenku-` 前缀，各书源分开存进度；“其他书源”只给出匹配候选，需核对作者与目录，不猜测章节对齐。

## API

- `GET /api/books?source=all&q=关键词&tag=题材&status=ongoing&page=1&sort=updated`，`source` 可为 `all`、`bili`、`sf`、`linovel`、`wenku`；分页固定 24 本，支持 `updated`、`title`、`new`（源内数字编号由新到旧）。
- `GET /api/books?ids=8,sf-775221,linovel-122429,wenku-1973`，为书架检查更新。
- `GET /api/book/:id`、`GET /api/book/:id/volume/:vid`、`GET /api/book/:id/chapter/:cid`。
- `GET /api/status`，索引数量、各源状态/范围/成功时间、最近同步和最新源站更新；`refresh=1` 请求检查。
- 图片代理仅允许四个书源已验证的 CDN 图片目录与栅格格式，不接受任意网址、端口、凭据或重定向。正文转成文字/图片块，由 React 渲染，拒绝外部脚本、事件属性和 iframe。

## 部署

`.github/workflows/deploy-novel.yml` 复用仓库现有 Cloudflare secrets，建立专用 `yukino-novel-cache` KV，部署 `yukino-novel` Worker、静态资源、15 分钟 Cron 和 `novel.yukino.bond` 自定义域名。同步部署可通过 `yukino-novel.3584643854.workers.dev` 访问。

部署脚本不读取、写入或打印凭据内容。`novel/.deploy/wrangler.json` 是忽略的运行时配置，KV ID 自动写入。部署后的 `verify-novel-live.mjs` 检查网站外壳、逐源状态、真实中文搜索和新增源的目录/免费正文。每次可见变更同步主站 `Changelog.tsx`。

书架与阅读足迹只在本机保存，不会上传给书源；备份仅含书目与进度。正文和插图权利归原作者与相关权利人，支持正版作品。
