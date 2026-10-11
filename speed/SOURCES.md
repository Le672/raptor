# 预置下载源

核验日期：2026-10-11。共 16 个完整地址，已实际读取数据，静态文件返回 HTTP 206 与有效 Content-Range；Cloudflare 按指定字节生成数据。

| 预置地址 | 客户端 | 文件大小 | 主要来源 |
| --- | --- | --- | --- |
| Cloudflare · 自动边缘节点 | 网页 / Windows | 按请求生成 | [官方下载 / 来源](https://speed.cloudflare.com/) |
| 中国电信 · 天翼云盘官方下载 | Windows | 387.10 MB | [官方下载 / 来源](https://cloud.189.cn/web/static/download-client/index.html) |
| 中国电信 · 营业厅官方下载 | Windows | 272.04 MB | [官方下载 / 来源](https://app.189.cn/) |
| 中国联通 · 联通云盘 Windows 文件 | Windows | 452.47 MB | [官方下载 / 来源](https://pan.wo.cn/client_download) |
| 中国联通 · 联通云盘 Mac 文件 | Windows | 344.98 MB | [官方下载 / 来源](https://pan.wo.cn/client_download) |
| 中国移动 · 营业厅官方下载 | Windows | 190.49 MB | [官方下载 / 来源](https://www.10086.cn/cmccclient/) |
| 中国广电 · 广东谷豆 TV 下载 | Windows | 41.73 MB | [官方下载 / 来源](https://www.gcable.com.cn/gdcp/gdtv/index.html) |
| 中国广电 · 营业厅公开资源 | 网页 / Windows | 0.21 MB | [官方下载 / 来源](https://m.10099.com.cn/cbn_client_download.html) |
| Steam · Fastly 客户端资源包 | Windows | 30.83 MB | [官方下载 / 来源](https://cdn.akamai.steamstatic.com/client/steam_client_win32) |
| Steam · Akamai 客户端资源包 | Windows | 30.83 MB | [官方下载 / 来源](https://cdn.akamai.steamstatic.com/client/steam_client_win32) |
| Steam · Fastly 官方安装文件 | Windows | 2.38 MB | [官方下载 / 来源](https://store.steampowered.com/about/) |
| Steam · Akamai 官方安装文件 | Windows | 2.38 MB | [官方下载 / 来源](https://store.steampowered.com/about/) |
| CacheFly · 100 MB 测试文件 | 网页 / Windows | 104.86 MB | [官方下载 / 来源](https://www.cachefly.com/) |
| Vultr · 新加坡 100 MB | 网页 / Windows | 104.86 MB | [官方下载 / 来源](https://sgp-ping.vultr.com/) |
| Vultr · 东京 100 MB | 网页 / Windows | 104.86 MB | [官方下载 / 来源](https://hnd-jp-ping.vultr.com/) |
| OVHcloud · 法国 100 MB | Windows | 104.86 MB | [官方下载 / 来源](https://proof.ovh.net/) |

具体 URL、官方来源、文件大小和跨域兼容性保存在 [src/servers.mjs](src/servers.mjs)，网页与 Windows 共用同一份目录。Steam 的资源包路径取自 Valve 当前公开客户端清单，无需手填。

运营商分组使用电信、联通、移动、广电的官方 CDN 文件及公开资源，不将第三方测试文件冒充运营商专网。CDN 实际出口及运营商归属可能随解析变化；Steam 客户端资源与具体游戏的 depot 线路也可能不同。中国广电营业厅图片源较小，适合低速或连通性检查；高带宽测试可用 Windows 的广东广电谷豆 TV 大文件。

静态文件会重复请求，读取后丢弃，不安装或执行。未开放 CORS 的地址只在 Windows 中执行，网页会直接显示兼容说明。Windows 使用系统代理及正常 TLS 验证；谷豆 TV 使用官网来源页作为 Referer。

当前中国广电全国 APP 版本接口给出的 2.3.0 APK 返回 404；旧的部分 Speedtest / U速通节点连接失败，未收入预置目录。公开 Speedtest 目录保留为额外搜索入口，返回的节点仍需现场检查。

核验结果只代表检查时的可达性。服务器、版本文件和区域策略可能变化，可在应用中检查连接或换用同类预置地址。

电信天翼云盘的官方稳定入口包含未开放跨域的跳转，故使用 Windows 自动跟随；不将短期签名 URL 固定成可长期使用的网页地址。
