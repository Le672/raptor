# Yukino Novel · 轻小说书房

独立轻小说网站，正式入口为 https://novel.yukino.bond 。与姬漫共用 Yukino 品牌和导航，使用主站现有 React、Vite 和 lucide-react 依赖；独立 Cloudflare Worker、静态资源和 KV 缓存不依赖主站登录。

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

- 通过 [lnovel 的公开 JSON 接口](https://github.com/yjl9903/lnovel/blob/main/examples/api.http)读取哔哩轻小说书目、详情、分卷与章节。此实现独立编写，未复制该项目代码。
- `/api/bili/novels` 是聚合方已索引的书库，**不是源站所有书籍**。开发时接口返回 724 条记录，过滤下架和重复项后为 719 本，包含 2026-10-19 的源站更新。界面显示实际数量，不写死书名和更新时间。
- Cloudflare Cron 每 15 分钟同步索引；目录与书目缓存 5 分钟、章节缓存 15 分钟，手动刷新最短 1 分钟。源站发布、翻译与上游缓存决定实际更新速度。上游详情与章节接口会在后台检查对应书籍更新。
- 本站同步时间、源站更新时间、上游抓取时间分别保留。失败时保留旧快照并明确显示原因和成功时间；空索引、登录 HTML、错误 JSON 不会覆盖成功快照。
- 共享索引保留 30 天、章节共享缓存 7 天。浏览器最近 180 个成功 API 响应缓存可在断网时回退。Service Worker 缓存应用外壳；插图由普通浏览器 HTTP 缓存决定离线可用性。
- `done` 表示上游整理任务完成，不代表小说完结；连载状态只依据上游明确标签。

## API

- `GET /api/books?q=关键词&tag=题材&status=ongoing&page=1&sort=updated`，分页固定 24 本，支持 `updated`、`title`、`new`（编号由新到旧）。
- `GET /api/books?ids=8,4649`，为书架检查更新。
- `GET /api/book/:id`、`GET /api/book/:id/volume/:vid`、`GET /api/book/:id/chapter/:cid`。
- `GET /api/status`，索引数量、最近同步、最新源站更新和缓存状态。
- 图片代理仅允许指定聚合域名下已知图片目录与栅格格式，不接受任意网址或重定向。正文转成文字/图片块，由 React 渲染，拒绝外部脚本、事件属性和 iframe。

## 部署

`.github/workflows/deploy-novel.yml` 复用仓库现有 Cloudflare secrets，建立专用 `yukino-novel-cache` KV，部署 `yukino-novel` Worker、静态资源、15 分钟 Cron 和 `novel.yukino.bond` 自定义域名。同步部署可通过 `yukino-novel.3584643854.workers.dev` 访问。

部署脚本不读取、写入或打印凭据内容。`novel/.deploy/wrangler.json` 是忽略的运行时配置，KV ID 自动写入。部署后的 `verify-novel-live.mjs` 检查网站外壳、持久化同步和真实中文搜索。主站的日志、首页、导航和跨域路由在同一提交更新。

书架与阅读足迹只在本机保存，不会上传给书源；备份仅含书目与进度。正文和插图权利归原作者与相关权利人，支持正版作品。
