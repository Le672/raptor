# Yukino Speed

网络测速与流量消耗工具，网页版与 Windows 原生下载引擎共用计量和控制逻辑。

- 在线使用：[speed.yukino.bond](https://speed.yukino.bond)
- 备用入口：[yukino-speed.pages.dev](https://yukino-speed.pages.dev)
- Windows 安装包、便携版与 SHA-256：[GitHub Releases](https://github.com/Le672/yukino-speed/releases/latest)
- 主站：[Yukino](https://www.yukino.bond/speed)

## 功能

内置 16 个完整下载地址，按电信、联通、移动、广电、Steam CDN 和全球文件分组，直接选择，无需手填。包括 Steam Fastly / Akamai 官方客户端资源包及安装文件、电信天翼云、联通云盘、移动营业厅、广电谷豆 TV 及公开资源，以及 Cloudflare、CacheFly、Vultr（东京 / 新加坡）、OVH。另保留公开 Speedtest 节点目录及自定义 URL。完整来源、文件大小与核验说明见 [SOURCES.md](SOURCES.md)。支持 1–32 个并发下载任务、定时测速或持续消耗、暂停 / 继续、配额自动停止、运行中调整共享带宽上限。显示实际已读取字节、持续时间、实时 MB/s 与 Mbps、平均与峰值带宽及曲线，保存本机历史，可导出 JSON。

全站累计由 Cloudflare D1 持久保存，包括网页与 Windows 客户端。统计接口只接收随机任务 ID、字节和时间，不接收下载 URL。每个任务使用独立随机密钥，重复、乱序和重试上报只计新增字节；断网记录自动补传。匿名客户端可以伪造其自身数据，因此公开总量明确标注为客户端上报。

任务凭据独立于待同步队列持久保存，已确认检查点、刷新和后续上报使用相同身份。单项失败不阻塞其他任务；独立域名暂时连接失败时统计和节点目录可切换到同数据库的 Pages 备用接口。

## 使用边界

统计的是下载有效载荷，十进制 MB/GB；1 MB/s = 8 Mbps。协议开销、取消时的网络 / 浏览器预读不包含在内，不能代替运营商计费记录。线程是并发下载任务，HTTP/2 等连接复用可能影响实际 TCP 连接数。

带宽控制在发出请求之前按所有线程共享的速率安排小块下载；不靠延迟显示字节伪造限速。瞬时速率可以波动，目标是下载上限而非保证吞吐量。推荐 Cloudflare 指定字节接口或支持 Range 的测试文件；不支持 Range 时预读与瞬时偏差可能更大。浏览器后台节流也会影响测速，Windows 使用跟随系统代理的原生 HTTP/TLS 流式读取，并在活动任务中阻止应用因系统省电而挂起。

网页版必须使用 HTTPS 且目标服务器允许 CORS。Windows 支持 HTTP 与没有 CORS 的目标，保持 TLS 证书验证、上下文隔离、renderer 沙盒及关闭 Node 集成，不关闭浏览器安全。Steam 预置地址已完整配置，可直接选用；使用公开客户端资源包和安装文件作为负载，不能保证与某款游戏的下载路由一致。运营商分类使用其官方 CDN 文件，不能保证专网出口。广电公开图片较小，高带宽可选 Windows 的谷豆 TV 文件。自定义的授权 / 签名文件仍须有效地址，签名链接可关闭防缓存参数。目录里的运营商节点兼容文件尚需本机检查，专用 Speedtest 协议不可用；本工具未采用 Ookla 官方测速算法。连接检查使用 HEAD，显示的是 HTTP 响应时间，不是 ICMP Ping。

本机历史保存在浏览器 LocalStorage；Windows 额外保存在应用用户目录 `runs.json`，待同步统计为 `reports.json`。结束应用会终止下载；网页关闭时保存最后检查点，尚未读取或尚未检查点的数据不能恢复。清除浏览器数据会移除本机网页统计和待同步数据。

## 开发

要求 Node.js 24 和 pnpm 11.25.0。

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm desktop
pnpm dist:win
```

测试覆盖跨线程配额、实际字节不截断、共享速率、暂停恢复、陈旧请求隔离、超时与错误重试；原生引擎在本地无 CORS 的 HTTP 服务器上验证 Range、重定向和取消。全站 API 使用真实 SQLite 验证重复 / 乱序提交、凭据与来源校验。

Cloudflare Pages 配置在 `wrangler.toml`，表结构在 `cloudflare/schema.sql`。数据库绑定名为 `DB`。自行部署时改为自己的 D1 ID，并执行 schema；Yukino 域名部署由主仓库 [Le672/raptor](https://github.com/Le672/raptor) 的 `Deploy Yukino Speed` workflow 使用既有 Cloudflare secrets 完成。核心不提供任意 URL 的服务端流量中转。

部署完成后，workflow 自动验证正式域名的 HTTPS 页面和持久统计接口。初次绑定域名时需要 DNS 编辑权限，或在 Cloudflare 控制台将 `speed` CNAME 指向 `yukino-speed.pages.dev`；域名已激活后可使用现有 Pages 部署权限继续发布。

源代码在主仓库 `speed/` 与此独立仓库同步，独立提交可通过 `git subtree split --prefix=speed` 生成，再推送至本仓库。推送与 package version 对应的 `v*` 标签即可在 Windows Actions 中测试、打包并发布安装版 / 便携版和校验文件。

## 隐私与许可证

目标下载服务器仍可看到正常网络连接来源。本站流量表不主动存储 IP、文件链接或个人账号；主机平台自身的请求日志受其政策管理。源码采用 MIT 许可证。第三方依赖保留其各自许可证。Windows 发行文件没有付费代码签名证书。
