# Yukino content sites on VPS

2026-10-31：影视、番剧、轻小说、测速与状态页使用原页面和 API，运行在 VPS 的独立 Node 服务中。测速历史与切换增量已从私人导出合并到本机 SQLite，公共域名已切换；旧 Pages 地址仅作静态跳转，不再执行统计或访问 D1。Cloudflare Tunnel 提供域名入口和 HTTPS，迁移后的页面和接口不使用主站的计算或数据库额度；三个内容站的旧 Worker 均停用，不再使用其 KV。内容站账户验证仍调用 `www.yukino.bond/api/auth/access`，每个活跃会话最多约五分钟一次。

## Build and deploy

在仓库根目录执行：

```text
node --test vps-content/runtime.test.mjs shared/test/content-access.test.mjs
node scripts/build-vps-content.mjs --build
```

产物为忽略目录 `.wrangler/vps-content/`，包含五个站点的静态页面、各自打包的服务端、适配器和 Undici。GitHub 的 `Validate and package VPS content sites` 工作流会测试并输出 `yukino-content-vps` 下载包，不再部署旧 Worker。当前使用工作区中已有的固定 SSH 身份部署：

```text
python ../vps-playground/migration/deploy.py
python ../vps-playground/remote_paramiko.py ../vps-playground/migration/status_remote.py
```

只有 `phase: ready` 和服务健康检查成功才算部署完成。上传结果未知时先查状态，不要重复启动部署。维护入口和首次域名切换工具位于同工作区 `vps-playground/migration/`。

## Runtime

- `/opt/yukino-content/current` 指向带时间戳的发布目录；`previous-release.json` 保存切换前的目标。
- 官方 Node 22.23.4 的 Linux x64 包在安装前验证 SHA-256；不依赖全局 npm 或 Docker 新镜像。
- `yukino-content.service` 使用动态用户、只读系统、768 MiB 内存限制，只监听 `127.0.0.1:18780`，按原 Host 分发五个站。隧道将五个域名直接交给这个回环端口。
- `/var/lib/yukino-content/{cinema,comic,novel,speed}/storage.sqlite` 保存独立快照、播放签名、测速记录和响应缓存，使用 WAL；每站响应缓存上限 128 MiB，私有响应及 Cookie 不入响应缓存。测速历史先从 D1 私人导出后导入，任务编号及凭据哈希保持不变；累计值由 SQLite 触发器按任务变化维护，普通查询只读一个汇总行。
- 三站每小时第 0、20、40 分钟同步；启动后各检查一次。外部请求只解析公网 IPv4，拒绝内网、回环和元数据地址，保留原接口的地址、签名和身份检查。
- `GET /__health` 返回站点、存储方式及最近计划任务的结束状态；`X-Yukino-Origin: vps-content` 可证明经过新服务。它不返回密钥、账户或缓存正文。
- `yukino-content-backup.timer` 每日运行 SQLite 在线备份，先验证完整性再保存各库摘要；备份目录 `/var/backups/yukino-content/` 为私人目录，包含签名密钥，应按凭据保护。

```sh
systemctl status yukino-content --no-pager
journalctl -u yukino-content -n 50 --no-pager
systemctl start yukino-content-backup
systemctl list-timers yukino-content-backup.timer
curl -H 'Host: cinema.yukino.bond' http://127.0.0.1:18780/__health
```

## Rollback and limits

服务器版本回退：将 `current` 指向 `previous-release.json` 中的旧目录，重启 `yukino-content`；不要覆盖或删除数据目录。首次迁移的 Cloudflare 配置备份保存在本机 `vps-playground/.private/content-migration-before.json`。旧 Worker 与 KV 数据保留，但计划任务、workers.dev 与自定义域名已停用；恢复边缘部署需要先恢复路由和定时配置，再处理 DNS，不能直接运行已停用的旧工作流。

收藏、书架、阅读与观看进度仍保存在相同域名的浏览器中；迁移缓存不会搬走这些本机记录。源站可能限制 VPS IP 或返回错误，各源继续单独展示真实状态。服务器健康、目录或传输校验不能证明 Chrome 已经实际解码播放；浏览器验证必须另行完成。

状态页同时检查静态页面与关键 JSON 接口，拒绝将 HTTP 200 的 HTML 回退页视作接口正常；浏览器保留带原始时间的上次检测。其页面及 `/api/status` 都在 VPS，不调用 D1，Cloudflare Workers/Pages 计算和 D1 超限不会使检测站一起失效。

状态域名打开时不挂载登录会话恢复、主站访问计数、网络信息和旧测速补报；这些可选信息的异常不会附着在检测页上。主站旧 `/status` 路径使用无需执行 Functions 的静态跳转，已打开的客户端也直接读取独立状态 API。

测速数据切换前，先用官方 Wrangler 将 `speed_runs` 导出到本机私人目录，并通过既有固定 SSH 身份传给自己的 VPS；不要放到仓库、日志或公开下载包。`python3 vps-content/import-speed.py /private/path/speed.sql` 只合并任务表，重复导入保留最大计数，任务凭据冲突时整笔回滚；导入后核对行数、累计量、完整性并运行在线备份，再切换测速域名。Cloudflare 原库保留，用于回退与核对切换期间的增量。

原有主站、邮箱、铁路、F1、Pixiv 等仍使用原部署方式。已经消耗的账号日额度不能通过部署清零；主站的账户服务仍需保有可用额度。本次隔离主要消耗来源，其他产品仍有各自的限制。
