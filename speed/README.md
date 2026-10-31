# Yukino Speed

网络测速与流量消耗工具，网页版与 Windows 原生下载引擎共用计量和控制逻辑。

- 在线使用：[speed.yukino.bond](https://speed.yukino.bond)
- 旧入口（自动跳转）：[yukino-speed.pages.dev](https://yukino-speed.pages.dev)
- Windows 安装包、便携版与 SHA-256：[GitHub Releases](https://github.com/Le672/yukino-speed/releases/latest)
- 主站：[Yukino](https://www.yukino.bond/)

## 功能

内置 339 个完整地址、覆盖 58 个国家和地区，169 个可直接在网页使用。按四运营商、国内 CDN、Steam 和全球节点分组，支持名称、国家地区、域名与兼容性组合筛选，无需手填。全球目录覆盖 Vultr、Akamai Cloud、Leaseweb、OVHcloud、HostHatch、DataPacket、EDIS Global、Psychz、Clouvider，保留 Steam Fastly / Akamai 官方资源包与安装文件。另保留公开 Speedtest 节点目录及自定义 URL。完整地址、大小、分段读取与来源说明见 [SOURCES.md](SOURCES.md)。支持 1–32 个并发下载任务、定时测速或持续消耗、暂停 / 继续、配额自动停止、运行中调整共享带宽上限。显示实际已读取字节、持续时间、实时 MB/s 与 Mbps、平均与峰值带宽及可悬停 / 触摸 / 键盘查看采样点的曲线，保存本机历史，可导出 JSON。

全站累计由 VPS SQLite 持久保存，包括网页与 Windows 客户端。统计接口只接收随机任务 ID、字节和时间，不接收下载 URL。每个任务使用独立随机密钥，重复、乱序和重试上报只计新增字节；断网记录自动补传。匿名客户端可以伪造其自身数据，因此公开总量明确标注为客户端上报。

任务凭据独立于待同步队列持久保存，已确认检查点、刷新和后续上报使用相同身份。单项失败不阻塞其他任务；旧 Pages 统计地址保留 307 跳转，网页和原有客户端最终读取同一服务器；这个旧地址不再提供独立后端。

所有网页入口统一使用独立测速站的统计 API；本站的 HTTPS 子域可以补报旧任务，来源不会因从 IP、专注或其他页面进入而被误拒绝。主站旧 `/speed` 地址先保留原任务 ID 和凭据补报，再转入正式域名；原域名的本机历史继续保留。`src/site-routing.mjs` 为主站与测速 Pages 共用的域名策略，错误的跨功能页面路径自动纠正，API 和静态资源不跳转。

## 使用边界

统计的是下载有效载荷，十进制 MB/GB；1 MB/s = 8 Mbps。协议开销、取消时的网络 / 浏览器预读不包含在内，不能代替运营商计费记录。线程是并发下载任务，HTTP/2 等连接复用可能影响实际 TCP 连接数。

带宽控制在发出请求之前按所有线程共享的速率安排小块下载；不靠延迟显示字节伪造限速。瞬时速率可以波动，目标是下载上限而非保证吞吐量。推荐 Cloudflare 指定字节接口或支持 Range 的测试文件；不支持 Range 时预读与瞬时偏差可能更大。网页下载使用独立 Worker，后台临时错误继续重试；断网、页面冻结、刷新或被回收后保留原任务 ID 与剩余配额，恢复页面后继续，手动暂停不自动恢复。手机系统可以冻结或回收页面，无法保证系统挂起期间持续下载；后台节流也会影响测速。Windows 使用跟随系统代理的原生 HTTP/TLS 流式读取，并在活动任务中阻止应用因系统省电而挂起。

网页版必须使用 HTTPS 且目标服务器允许 CORS。Windows 支持 HTTP 与没有 CORS 的目标，保持 TLS 证书验证、上下文隔离、renderer 沙盒及关闭 Node 集成，不关闭浏览器安全。Steam 预置地址已完整配置，可直接选用；使用公开客户端资源包和安装文件作为负载，不能保证与某款游戏的下载路由一致。运营商分类使用其官方 CDN 文件，不能保证专网出口。广电公开图片较小，高带宽可选 Windows 的谷豆 TV 文件。自定义的授权 / 签名文件仍须有效地址，签名链接可关闭防缓存参数。目录里的运营商节点兼容文件尚需本机检查，专用 Speedtest 协议不可用；本工具未采用 Ookla 官方测速算法。连接检查使用 HEAD，显示的是 HTTP 响应时间，不是 ICMP Ping。

本机历史保存在浏览器 LocalStorage；Windows 额外保存在应用用户目录 `runs.json`，待同步统计为 `reports.json`。结束应用会终止下载；网页在每个状态更新和切换后台时保存当前标签页检查点，重载同一标签页可恢复原任务；新的标签页不会自动恢复旧历史。尚未读取或尚未检查点的数据不能恢复。清除浏览器数据会移除本机网页统计和待同步数据。

## 开发

要求 Node.js 24 和 pnpm 11.25.0。

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm desktop
pnpm dist:win
pnpm sources:check
```

`pnpm sources:check` 会使用 Windows 原生下载连接逐个读取内置源的少量数据，结果保存到忽略提交的 `qa-output/source-checks.json`；此检查需要网络，未关闭 TLS 校验。

测试覆盖跨线程配额、实际字节不截断、共享速率、暂停恢复、陈旧请求隔离、超时与错误重试；原生引擎在本地无 CORS 的 HTTP 服务器上验证 Range、重定向和取消。全站 API 使用真实 SQLite 验证重复 / 乱序提交、凭据与来源校验。

2026-10-31 起，页面与统计服务使用主仓库的 `vps-content` 运行环境，维护步骤见 `../vps-content/README.md`。原 D1 历史和切换期间增量已私人导出、核对并合并，任务身份与重复上报规则不变；原库保留作核对与回退，当前流量不再写入它。旧的 Pages 部署工作流与数据库绑定已停用，避免再次消耗共享额度。

`node scripts/retire-speed-pages.mjs --deploy`（从主仓库根目录执行）可重新发布旧 `yukino-speed.pages.dev` 的静态跳转，隔离产物不包含 Functions 或 D1。正式 `speed.yukino.bond` 经现有 Cloudflare Tunnel 到 VPS，不要重新绑定到 Pages。测速负载仍直接来自用户选择的下载服务器，不经 VPS 中转。

源代码在主仓库 `speed/` 与此独立仓库同步，独立提交可通过 `git subtree split --prefix=speed` 生成，再推送至本仓库。推送与 package version 对应的 `v*` 标签即可在 Windows Actions 中测试、打包并发布安装版 / 便携版和校验文件。

## 隐私与许可证

目标下载服务器仍可看到正常网络连接来源。本站流量表不主动存储 IP、文件链接或个人账号；主机平台自身的请求日志受其政策管理。源码采用 MIT 许可证。第三方依赖保留其各自许可证。Windows 发行文件没有付费代码签名证书。
