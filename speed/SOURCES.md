# 预置下载源

核验日期：2026-10-11。共 **204 个不同地址、182 个域名、26 个国家和地区**，其中 107 个标为网页 / Windows 可用。已有所有预置源与此次新增源均实际读取过数据；按地址去重，Cloudflare 的不同 bytes 参数合并为一个动态接口。不同文件可能共用一个域名，此处数量是可选地址，不是独立物理服务器数。

参考用户指定的 [use.wuxie.de](https://use.wuxie.de/)、[lhh.la/tools/cesu](https://lhh.la/tools/cesu)、[shua.leyz.top/sl](https://shua.leyz.top/sl/)，同时直接读取 Vultr、Akamai、Leaseweb、OVHcloud、HostHatch 的官方地区目录和下载端点。失效、无数据、返回错误页及证书异常的候选未收入。引用其公开文件地址与名称线索，界面和下载引擎由本项目独立实现。

网页支持搜索名称、国家地区和域名，以及国家 / 地区、网页兼容性、分类组合筛选。四运营商、Steam 和自定义地址继续保留。

## 兼容性与计量

- 网页需要 HTTPS、完整重定向链允许 CORS；必须附带特定来源页的文件只在 Windows 使用。
- Windows 使用系统代理，保持 TLS 校验；必要来源页及不能添加缓存参数的地址由预置配置处理。
- 35 个源未支持 Range，配额结束时可能超出一个实际读取的数据块，限速会有波动；精确配额优先选 Cloudflare 或标记支持分段读取的文件。所有实际读取的完整字节块仍会计入统计。
- 小图片和脚本适合低速 / 连通性检查，大带宽更适合 100 MB、1 GB 测试文件。脚本、安装包、媒体与其他文件均仅读取后丢弃，不保存或执行。
- 地区采用提供方标示；国内服务和 CDN 资源的实际边缘节点随网络解析变化，不保证运营商专网或特定游戏的下载路由，不承诺任何定向流量计费。
- 核验只代表检查时的可达性，文件版本、区域政策与路由可能变化。

## 全部地址

| 地址名称 | 地区 | 客户端 | 文件大小 | 分段读取 | 来源 |
| --- | --- | --- | --- | --- | --- |
| [Cloudflare · 自动边缘节点](https://speed.cloudflare.com/__down) | 全球 Anycast | 网页 / Windows | 动态数据 | 支持 | [官方来源](https://speed.cloudflare.com/) |
| [中国电信 · 天翼云盘官方下载](https://download.cloud.189.cn/download/client/android/cloud189_v11.1.1_1788507428683.apk) | 中国大陆 · 官方 CDN | Windows | 387.10 MB | 支持 | [官方来源](https://cloud.189.cn/web/static/download-client/index.html) |
| [中国电信 · 营业厅官方下载](https://appupdates.189.cn/client/ctclientchannel78.apk) | 中国大陆 · 官方 CDN | Windows | 272.04 MB | 支持 | [官方来源](https://app.189.cn/) |
| [中国联通 · 联通云盘 Windows 文件](https://pack.pan.wo.cn/download/WoCloud-2.8.13.exe) | 中国大陆 · 官方 CDN | Windows | 452.47 MB | 支持 | [官方来源](https://pan.wo.cn/client_download) |
| [中国联通 · 联通云盘 Mac 文件](https://pack.pan.wo.cn/download/WoCloud-2.8.13-x64.dmg) | 中国大陆 · 官方 CDN | Windows | 344.98 MB | 支持 | [官方来源](https://pan.wo.cn/client_download) |
| [中国移动 · 营业厅官方下载](https://res.app.coc.10086.cn/downfile/apk/CM10086_android_V11.9.2_20250424195533224.apk) | 中国大陆 · 官方 CDN | Windows | 190.49 MB | 支持 | [官方来源](https://www.10086.cn/cmccclient/) |
| [中国广电 · 广东谷豆 TV 下载](https://www.gcable.com.cn/css/GoodTV-AndroidPhone-3.13.0_9226.apk) | 中国大陆 · 广东广电官方 | Windows | 41.73 MB | 支持 | [官方来源](https://www.gcable.com.cn/gdcp/gdtv/index.html) |
| [中国广电 · 营业厅公开资源](https://m.10099.com.cn/gwecdq/gWrwMYe20RGkxiCubXa8nc5yN1ldZUIT.jpg) | 中国大陆 · 官方资源 CDN | 网页 / Windows | 0.21 MB | 支持 | [官方来源](https://m.10099.com.cn/cbn_client_download.html) |
| [Steam · Fastly 客户端资源包](https://cdn.fastly.steamstatic.com/client/steamui_websrc_all.zip.399ab78a41fd3867bf178d8bcee57db47a9de0bd) | Steam 官方 · Fastly CDN | Windows | 30.83 MB | 支持 | [官方来源](https://cdn.akamai.steamstatic.com/client/steam_client_win32) |
| [Steam · Akamai 客户端资源包](https://cdn.akamai.steamstatic.com/client/steamui_websrc_all.zip.399ab78a41fd3867bf178d8bcee57db47a9de0bd) | Steam 官方 · Akamai CDN | Windows | 30.83 MB | 支持 | [官方来源](https://cdn.akamai.steamstatic.com/client/steam_client_win32) |
| [Steam · Fastly 官方安装文件](https://cdn.fastly.steamstatic.com/client/installer/SteamSetup.exe) | Steam 官方 · Fastly CDN | Windows | 2.38 MB | 支持 | [官方来源](https://store.steampowered.com/about/) |
| [Steam · Akamai 官方安装文件](https://cdn.akamai.steamstatic.com/client/installer/SteamSetup.exe) | Steam 官方 · Akamai CDN | Windows | 2.38 MB | 支持 | [官方来源](https://store.steampowered.com/about/) |
| [CacheFly · 100 MB 测试文件](https://cachefly.cachefly.net/100mb.test) | 全球 CDN | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://www.cachefly.com/) |
| [Vultr · 新加坡 100 MB](https://sgp-ping.vultr.com/vultr.com.100MB.bin) | 新加坡 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://sgp-ping.vultr.com/) |
| [Vultr · 东京 100 MB](https://hnd-jp-ping.vultr.com/vultr.com.100MB.bin) | 日本东京 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://hnd-jp-ping.vultr.com/) |
| [OVHcloud · 法国 100 MB](https://proof.ovh.net/files/100Mb.dat) | 法国 | Windows | 104.86 MB | 支持 | [官方来源](https://proof.ovh.net/) |
| [Wuxie · Cloudflare R2 测试文件](https://r2.wuxie.de/hello100.png) | 全球 CDN · 自动调度 | Windows | 104.86 MB | 支持 | [参考页面](https://use.wuxie.de/) |
| [百度CDN](https://issuecdn.baidupcs.com/issue/netdisk/apk/BaiduNetdiskSetup_wap_share.apk) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 198.72 MB | 支持 | [参考页面](https://use.wuxie.de/) |
| [字节跳动](https://p9-arcosite.byteimg.com/tos-cn-i-goo7wpa0wc/00fb66006eb84b16965b620b6e1f2d78~tplv-goo7wpa0wc-image.image) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 1.51 MB | 支持 | [参考页面](https://use.wuxie.de/) |
| [腾讯 · WeGame](https://wegame.gtimg.com/g.55555-r.c4663/wegame-home/sc02-03.514d7db8.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.83 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [vivo](https://wwwstatic.vivo.com.cn/vivoportal/files/resource/funtouch/1651200648928/images/os2-jude-video.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 4.42 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [腾讯 · 游戏宣传视频](https://bns.lv.game.qq.com/dis_kt_271ff5afcc739860b7cbf358a2256d75_1700728513/0b53cyaagaaatyaa52c7evs6ofwdamlaaaya.f0.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 6.64 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [字节跳动 · 抖音](https://lf1-cdn-tos.bytegoofy.com/goofy/ies/douyin_home_web/imgs/mob_1-1.15453147.gif) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.00 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [哔哩哔哩](https://i2.hdslb.com/bfs/openplatform/202506/ndIMphTF1750406775833.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.38 MB | 支持 | [参考页面](https://use.wuxie.de/) |
| [中国移动 · 咪咕](https://wcache.migu.cn/prod/upload/game_resource/contentRelated/006212638000/84/1662605671282.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.35 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [腾讯](https://static-res.qq.com/web/im.qq.com/qq9-introduction.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 24.01 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [快手](https://alimov2.a.kwimgs.com/upic/2024/03/29/19/BMjAyNDAzMjkxOTI2MjdfNzAxNDkwODM5XzEyODQ3NjA0NzA1MF8xXzM=_b_Bcaebd79754ad49a73f606219c2461ce5.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 10.93 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [拼多多](https://img.pddpic.com/mms-material-img/2025-07-24/275617a7-4795-414a-b472-c06f11e79b37.jpeg.a.jpeg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.12 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [中国移动 · 移动云盘①](https://img.mcloud.139.com/material_prod/material_media/20221128/1669626861087.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 1.14 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [小米](https://cdn.cnbj1.fds.api.mi-img.com/product-images/xiaomi-15_852852/images/14.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 1.09 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [百度](https://jmy-video.baidu.com/011b7fe3c5f101b0a4968402e5ca06e0_1920_1080.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.75 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [华为](https://consumer.huawei.com/content/dam/huawei-cbg-site/cn/mkt/mobileservices/video-2026/images/huawei-video-kv-01-xs.webp) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.39 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [AcFun](https://tx-free-imgs.acfun.cn/o4jJrDBmjG-ju2QVr-BrmQ3e-VRjmia-mE7fiu.jpg?imageslim&imageView2/1/w/690/h/208/format/jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.28 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [中国电信 · 天翼云](https://desk.ctyun.cn/desktop/software/clientsoftware/download/ff3e71dcc21152307f54700c62e5aef6) | 中国大陆服务 · CDN 自动调度 | Windows | 52.59 MB | 支持 | [参考页面](https://use.wuxie.de/) |
| [哔哩哔哩 · bilibili](https://i0.hdslb.com/bfs/album/6a259a872289fbf56e61876c9b8870a9868325af.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 1.50 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [斗鱼](https://rpic.douyucdn.cn/live-cover/appCovers/2024/01/12/5820055_20240112025246.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.55 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [网易](https://g.fp.ps.netease.com/cg-image/file/673d45661e7b3dacd86e0895QHZHgDb705?fop=imageView/2/w/1200/h/680/f/jpeg/q/60) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.13 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [字节跳动 · 朝夕光年游戏](https://lf5-j1gamecdn-cn.dailygn.com/obj/lf-game-lf/gdl_app_2682/1233880772355.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 49.06 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国电信 · 电信](https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202000005/CtyunClouddeskUniversal_2.0.0_202000005_x86_20230421161227_Setup_Signed.exe) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 78.15 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [京东](https://jvod.300hu.com/vod/product/351f867b-b6fd-4107-8cbe-46b1e2064ede/8bce0b70e00746a7a187e904dd3f98ce.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 3.22 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [腾讯视频](https://puui.qpic.cn/vpic_cover/g3346tki83w/g3346tki83w_hz.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 3.34 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [腾讯①](https://ossweb-img.qq.com/images/lol/web201310/skin/big10001.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.45 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [Akamai CDN · Akamai · 公开媒体片段](https://akamtrans-a.akamaihd.net/delivery/2023/08/30/brand-protector-2500k-00004.ts) | 全球 CDN · 自动调度 | 网页 / Windows | 5.18 MB | 支持 | [参考页面](https://lhh.la/tools/cesu) |
| [腾讯②](https://ossweb-img.qq.com/upload/webplat/info/cf/20230717/653421385804853.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 2.83 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [百度 · 好看视频](https://vd3.bdstatic.com/mda-pm9zn07ydwzhfw85/1080p/cae_h264/1702252000350219836/mda-pm9zn07ydwzhfw85.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 13.40 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [爱奇艺](https://static-d.iqiyi.com/ext/common/iQIYIMedia_000.dmg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 40.78 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国联通 · 联通电视①](https://listen.10155.com/listener/womusic-bucket/90115000/mv_vod/volte_mp4/20250113/25011310461878632856356618241.mp4?user=N/A&channelid=3000013947&contentid=97720000202501134237680&id=7806C0ECA5815296727516B237939874&timestamp=1737618838&isSegment=0) | 中国大陆服务 · CDN 自动调度 | Windows | 14.57 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [百度网盘③](https://staticsns.cdn.bcebos.com/amis/2024-12/1733110167508/ec2943f8f5e27bd38f00c6e02.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.15 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国联通 · 联通电视③](https://listen.10155.com/listener/womusic-bucket/90115000/mv_vod/volte_mp4/20250122/25012211351881906856159535106.mp4?user=N/A&channelid=3000013947&contentid=91789000202501225046120&id=BF48AF05B7EEF59FA42A2B63EE194BB9&timestamp=1737620144&isSegment=0) | 中国大陆服务 · CDN 自动调度 | Windows | 16.27 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国联通 · 联通电视②](https://listen.10155.com/listener/womusic-bucket/90115000/mv_vod/volte_mp4/20250107/25010717451876559137903665153.mp4?user=N/A&channelid=3000013947&contentid=91789000202501073774710&id=F031747CA9A3198960CC36A1F0A3CD6B&timestamp=1737618923&isSegment=0) | 中国大陆服务 · CDN 自动调度 | Windows | 30.81 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [百度网盘②](https://issuepcdn.baidupcs.com/issue/netdisk/yunguanjia/BaiduNetdisk_7.54.0.103.exe) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 413.14 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [百度网盘①](https://wppkg.baidupcs.com/issue/netdisk/apk/BaiduNetdisk_10.1.02.apk) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 113.23 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国联通 · 沃音乐①](https://listen.10155.com/listener/womusic-bucket/90115000/mv_vod/volteposter/screenshot/20220129/1487368366712385537.jpeg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.06 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国联通 · 沃音乐②](https://listen.10155.com/listener/womusic-bucket/90115000/mv_vod/volteposter/screenshot/20200805/1290977212593999873.jpeg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.05 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国联通 · 联通广告公开资源①](https://m1.ad.10010.com/small_video/uploadImg/1598021193891.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.05 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [gw.alicdn.com · 阿里系①](https://gw.alicdn.com/tfscom/TB1fASCxhjaK1RjSZKzXXXVwXXa.jpg) | 全球 CDN · 自动调度 | 网页 / Windows | 0.29 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [gw.alicdn.com · 钉钉](https://gw.alicdn.com/tfs/TB1k07QUoY1gK0jSZFCXXcwqXXa-810-450.png) | 全球 CDN · 自动调度 | 网页 / Windows | 0.47 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国联通 · 联通云](https://www.cucloud.cn/upload/1717685645631.png) | 中国大陆服务 · CDN 自动调度 | Windows | 0.16 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [字节跳动 · 今日头条](https://lf9-static.bytednsdoc.com/obj/eden-cn/uhbfnupkbps/video/earth_v6.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 21.15 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [字节跳动①](https://lf1-cdn-tos.bytescm.com/obj/static/ies/bytedance_official/_next/static/images/8-4@2x-f85835b5e482bccf94c824067caac899.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.94 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [字节跳动②](https://lf3-cdn-tos.bytescm.com/obj/ttfe/ATSX/mainland/video-poster_1576231362701.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.37 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国电信 · 天翼云盘](https://static.e.189.cn/open/login/page/web/v5.0/static/js/captch.min.js?v1.1) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.10 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国电信 · 天翼云桌面①](https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202030001/CtyunClouddeskUniversal_2.3.0_202030001_x86_20240327104015_Setup.exe) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 87.17 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [百度 · 公开图片](https://jmy-pic.baidu.com/0/pic/1203225490_216151106_2084668354.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.80 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国电信 · 电信21](https://review.21cn.com/img/20220610/1/1654859008246.mp4) | 中国大陆服务 · CDN 自动调度 | Windows | 3.87 MB | 未支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 移动云盘②](https://yun.mcloud.139.com/hongseyunpan/2.43G.zip) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 2590.28 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 移动云盘③](https://open.yun.139.com/static/img/case_bg_1.16716f8f.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 1.40 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 移动云盘④](https://img.mcloud.139.com/material_prod/material_media/20230605/1685935277971.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.19 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 咪咕视频①](https://img.cmvideo.cn/publish/noms/2023/12/06/1O4SHFIFR36BD.gif) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.00 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 咪咕视频②](https://img.cmvideo.cn/publish/noms/2022/10/14/1O3VIGPVP6HTS.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.00 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 咪咕快游②](https://freeserver.migufun.com/resource/beta/video/system/20210924112351666.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 21.34 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 咪咕快游①](https://freeserver.migufun.com/resource/beta/picture/system/20200723/20200723104326220_sdpic.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 5.00 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 139邮箱①](https://img.mcloud.139.com/material_prod/material_media/20241105/1730784603634.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.08 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [快手](https://alimov2.a.kwimgs.com/upic/2024/11/18/17/BMjAyNDExMTgxNzM0NTFfMjQ2MzY1ODI4MV8xNDg5NTc1NTQwNDBfMl8z_b_Ba0e085802ad867415b13e560bab69dd2.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 24.44 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 139邮箱②](https://img.mcloud.139.com/material_prod/material_media/20241105/1730784682069.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.07 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [京东](https://img20.360buyimg.com/babel/jfs/t20271006/227634/23/27810/35856/67027beeF0cffb9fc/e68cd03835b91103.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.02 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 移动](https://img1.shop.10086.cn/goods/tcqtjwurkdsfcxgr_940x7200) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.63 MB | 未支持 | [参考页面](https://shua.leyz.top/sl/) |
| [夸克 / UC · 夸克浏览器](https://image.uc.cn/s/uae/g/3o/broccoli/resource/202401/zry_video.mp4) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 35.02 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [微软中国商店 · 公开图片](https://cdn.microsoftstore.com.cn/media/product_long_description/3781-00000/2_dupn50xr/4h0yzz2_360.jpg) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.77 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [OPPO商城](https://dsfs.oppo.com/oppo/shop-pc-v2/main/js/9fb472f.js) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 4.24 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [哔哩哔哩 · B站①](https://s1.hdslb.com/bfs/game-static/web/caster/static/script/vue/da3f37d7fd8339357ed671a94941757e/st.zip) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 5.28 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国移动 · 咪咕爱看](https://img.aikan.miguvideo.com/publish/noms/2024/04/22/1O5MNLF3AN2JL.gif) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 2.65 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [拼多多H5](https://static.pddpic.com/assets/js/react_pdd_50c6d8bdb252d256ae20_1026.js) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 1.21 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [哔哩哔哩 · B站②](https://s3.hdslb.com/bfs/game-static/web/caster/static/script/vue/da3f37d7fd8339357ed671a94941757e/st.zip) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 5.28 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [新浪](http://i.apps.sina.cn/tqt/zip/com.sina.tianqitong_6.1892_2019.07.29.17.54.18.apk) | 中国大陆服务 · CDN 自动调度 | Windows | 19.87 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [拼多多②](https://cd.pddpic.com/android_dev/2023-07-28/5c04772968aee57ca690fbe1e7f29467.apk) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 30.30 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [哔哩哔哩 · 上海灵羊](https://activity.hdslb.com/blackboard/static/20210604/4d40bc4f98f94fbc71c235832ce3efd4/hJEhL6jGOY.zip) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 6.45 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [拼多多H5](https://funimg.pddpic.com/c3affbeb-9b31-4546-b2df-95b62de81639.png.slim.png) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 0.03 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [cloud.video.taobao.com · 夸克网盘](https://cloud.video.taobao.com/play/u/null/p/1/e/6/t/1/442087612070.mp4) | 全球 CDN · 自动调度 | 网页 / Windows | 10.46 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [CacheFly · 200 MB 测试文件](https://cachefly.cachefly.net/200mb.test) | 全球 CDN · 自动调度 | 网页 / Windows | 209.72 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [Vultr · 美国 · 新泽西 · 1 GB 文件](https://nj-us-ping.vultr.com/vultr.com.1000MB.bin) | 美国 · 新泽西 | 网页 / Windows | 1048.58 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [Vultr · 新加坡 · 新加坡 · 1 GB 文件](https://sgp-ping.vultr.com/vultr.com.1000MB.bin) | 新加坡 · 新加坡 | 网页 / Windows | 1048.58 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [BBC · 公开脚本文件](https://emp.bbci.co.uk/emp/dashjs/3.2.0-8/dash.all.min.js) | 全球 CDN · 自动调度 | 网页 / Windows | 动态数据 | 未支持 | [参考页面](https://shua.leyz.top/sl/) |
| [GitHub 第三方镜像 · GitHub · 第三方公开文件镜像](https://gh.con.sh/https://github.com/AaronFeng753/Waifu2x-Extension-GUI/releases/download/v2.21.12/Waifu2x-Extension-GUI-v2.21.12-Portable.7z) | 全球 CDN · 自动调度 | 网页 / Windows | 0.00 MB | 未支持 | [参考页面](https://shua.leyz.top/sl/) |
| [Akamai Cloud · 日本 · 东京 · 100 MB 文件](https://speedtest.tokyo2.linode.com/100MB-tokyo2.bin) | 日本 · 东京 | Windows | 104.86 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [img.alicdn.com · 阿里系②](https://img.alicdn.com/imgextra/i1/O1CN01xA4P9S1JsW2WEg0e1_!!6000000001084-2-tps-2880-560.png) | 全球 CDN · 自动调度 | Windows | 1.43 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [中国电信 · 天翼云桌面②](https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202010003/CtyunClouddeskUniversal_2.1.0_202010003_x86_20230905151733_Setup_signed.exe) | 中国大陆服务 · CDN 自动调度 | 网页 / Windows | 78.73 MB | 支持 | [参考页面](https://shua.leyz.top/sl/) |
| [Vultr · 日本 · 大阪](https://osk-jp-ping.vultr.com/vultr.com.100MB.bin) | 日本 · 大阪 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://osk-jp-ping.vultr.com/) |
| [Vultr · 印度 · 孟买](https://bom-in-ping.vultr.com/vultr.com.100MB.bin) | 印度 · 孟买 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://bom-in-ping.vultr.com/) |
| [Vultr · 印度 · 班加罗尔](https://blr-in-ping.vultr.com/vultr.com.100MB.bin) | 印度 · 班加罗尔 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://blr-in-ping.vultr.com/) |
| [Vultr · 韩国 · 首尔](https://sel-kor-ping.vultr.com/vultr.com.100MB.bin) | 韩国 · 首尔 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://sel-kor-ping.vultr.com/) |
| [Vultr · 南非 · 约翰内斯堡](https://jnb-za-ping.vultr.com/vultr.com.100MB.bin) | 南非 · 约翰内斯堡 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://jnb-za-ping.vultr.com/) |
| [Vultr · 印度 · 德里](https://del-in-ping.vultr.com/vultr.com.100MB.bin) | 印度 · 德里 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://del-in-ping.vultr.com/) |
| [Vultr · 以色列 · 特拉维夫](https://tlv-il-ping.vultr.com/vultr.com.100MB.bin) | 以色列 · 特拉维夫 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://tlv-il-ping.vultr.com/) |
| [Vultr · 澳大利亚 · 悉尼](https://syd-au-ping.vultr.com/vultr.com.100MB.bin) | 澳大利亚 · 悉尼 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://syd-au-ping.vultr.com/) |
| [Vultr · 澳大利亚 · 墨尔本](https://mel-au-ping.vultr.com/vultr.com.100MB.bin) | 澳大利亚 · 墨尔本 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://mel-au-ping.vultr.com/) |
| [Vultr · 荷兰 · 阿姆斯特丹](https://ams-nl-ping.vultr.com/vultr.com.100MB.bin) | 荷兰 · 阿姆斯特丹 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://ams-nl-ping.vultr.com/) |
| [Vultr · 德国 · 法兰克福](https://fra-de-ping.vultr.com/vultr.com.100MB.bin) | 德国 · 法兰克福 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://fra-de-ping.vultr.com/) |
| [Vultr · 英国 · 伦敦](https://lon-gb-ping.vultr.com/vultr.com.100MB.bin) | 英国 · 伦敦 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://lon-gb-ping.vultr.com/) |
| [Vultr · 英国 · 曼彻斯特](https://man-uk-ping.vultr.com/vultr.com.100MB.bin) | 英国 · 曼彻斯特 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://man-uk-ping.vultr.com/) |
| [Vultr · 意大利 · 米兰](https://mxp-it-ping.vultr.com/vultr.com.100MB.bin) | 意大利 · 米兰 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://mxp-it-ping.vultr.com/) |
| [Vultr · 法国 · 巴黎](https://par-fr-ping.vultr.com/vultr.com.100MB.bin) | 法国 · 巴黎 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://par-fr-ping.vultr.com/) |
| [Vultr · 西班牙 · 马德里](https://mad-es-ping.vultr.com/vultr.com.100MB.bin) | 西班牙 · 马德里 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://mad-es-ping.vultr.com/) |
| [Vultr · 瑞典 · 斯德哥尔摩](https://sto-se-ping.vultr.com/vultr.com.100MB.bin) | 瑞典 · 斯德哥尔摩 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://sto-se-ping.vultr.com/) |
| [Vultr · 波兰 · 华沙](https://waw-pl-ping.vultr.com/vultr.com.100MB.bin) | 波兰 · 华沙 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://waw-pl-ping.vultr.com/) |
| [Vultr · 美国 · 洛杉矶](https://lax-ca-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 洛杉矶 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://lax-ca-us-ping.vultr.com/) |
| [Vultr · 美国 · 达拉斯](https://tx-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 达拉斯 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://tx-us-ping.vultr.com/) |
| [Vultr · 美国 · 檀香山](https://hon-hi-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 檀香山 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://hon-hi-us-ping.vultr.com/) |
| [Vultr · 美国 · 芝加哥](https://il-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 芝加哥 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://il-us-ping.vultr.com/) |
| [Vultr · 美国 · 亚特兰大](https://ga-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 亚特兰大 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://ga-us-ping.vultr.com/) |
| [Vultr · 墨西哥 · 墨西哥城](https://mex-mx-ping.vultr.com/vultr.com.100MB.bin) | 墨西哥 · 墨西哥城 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://mex-mx-ping.vultr.com/) |
| [Vultr · 美国 · 新泽西](https://nj-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 新泽西 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://nj-us-ping.vultr.com/) |
| [Vultr · 加拿大 · 多伦多](https://tor-ca-ping.vultr.com/vultr.com.100MB.bin) | 加拿大 · 多伦多 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://tor-ca-ping.vultr.com/) |
| [Vultr · 美国 · 硅谷](https://sjo-ca-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 硅谷 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://sjo-ca-us-ping.vultr.com/) |
| [Vultr · 美国 · 西雅图](https://wa-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 西雅图 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://wa-us-ping.vultr.com/) |
| [Vultr · 美国 · 迈阿密](https://fl-us-ping.vultr.com/vultr.com.100MB.bin) | 美国 · 迈阿密 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://fl-us-ping.vultr.com/) |
| [Akamai Cloud · 美国 · 洛杉矶](https://speedtest.los-angeles.linode.com/garbage.php?ckSize=1) | 美国 · 洛杉矶 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.los-angeles.linode.com/) |
| [Vultr · 智利 · 圣地亚哥](https://scl-cl-ping.vultr.com/vultr.com.100MB.bin) | 智利 · 圣地亚哥 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://scl-cl-ping.vultr.com/) |
| [Akamai Cloud · 美国 · 达拉斯](https://speedtest.dallas.linode.com/garbage.php?ckSize=1) | 美国 · 达拉斯 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.dallas.linode.com/) |
| [Akamai Cloud · 美国 · 迈阿密](https://speedtest.miami.linode.com/garbage.php?ckSize=1) | 美国 · 迈阿密 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.miami.linode.com/) |
| [Akamai Cloud · 美国 · 芝加哥](https://speedtest.chicago.linode.com/garbage.php?ckSize=1) | 美国 · 芝加哥 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.chicago.linode.com/) |
| [Akamai Cloud · 美国 · 亚特兰大](https://speedtest.atlanta.linode.com/garbage.php?ckSize=1) | 美国 · 亚特兰大 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.atlanta.linode.com/) |
| [Akamai Cloud · 美国 · 弗里蒙特](https://speedtest.fremont.linode.com/garbage.php?ckSize=1) | 美国 · 弗里蒙特 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.fremont.linode.com/) |
| [Vultr · 巴西 · 圣保罗](https://sao-br-ping.vultr.com/vultr.com.100MB.bin) | 巴西 · 圣保罗 | 网页 / Windows | 104.86 MB | 支持 | [官方来源](https://sao-br-ping.vultr.com/) |
| [Akamai Cloud · 美国 · 纽瓦克](https://speedtest.newark.linode.com/garbage.php?ckSize=1) | 美国 · 纽瓦克 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.newark.linode.com/) |
| [Akamai Cloud · 巴西 · 圣保罗](https://speedtest.sao-paulo.linode.com/garbage.php?ckSize=1) | 巴西 · 圣保罗 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.sao-paulo.linode.com/) |
| [Akamai Cloud · 美国 · 西雅图](https://speedtest.seattle.linode.com/garbage.php?ckSize=1) | 美国 · 西雅图 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.seattle.linode.com/) |
| [Akamai Cloud · 美国 · 华盛顿](https://speedtest.washington.linode.com/garbage.php?ckSize=1) | 美国 · 华盛顿 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.washington.linode.com/) |
| [Akamai Cloud · 加拿大 · 多伦多](https://speedtest.toronto1.linode.com/garbage.php?ckSize=1) | 加拿大 · 多伦多 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.toronto1.linode.com/) |
| [Akamai Cloud · 德国 · 法兰克福扩展](https://de-fra-2.speedtest.linode.com/garbage.php?ckSize=1) | 德国 · 法兰克福扩展 | Windows | 动态数据 | 未支持 | [官方来源](https://de-fra-2.speedtest.linode.com/) |
| [Akamai Cloud · 荷兰 · 阿姆斯特丹](https://speedtest.amsterdam.linode.com/garbage.php?ckSize=1) | 荷兰 · 阿姆斯特丹 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.amsterdam.linode.com/) |
| [Akamai Cloud · 英国 · 伦敦扩展](https://gb-lon.speedtest.linode.com/garbage.php?ckSize=1) | 英国 · 伦敦扩展 | Windows | 动态数据 | 未支持 | [官方来源](https://gb-lon.speedtest.linode.com/) |
| [Akamai Cloud · 西班牙 · 马德里](https://speedtest.madrid.linode.com/garbage.php?ckSize=1) | 西班牙 · 马德里 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.madrid.linode.com/) |
| [Akamai Cloud · 英国 · 伦敦](https://speedtest.london.linode.com/garbage.php?ckSize=1) | 英国 · 伦敦 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.london.linode.com/) |
| [Akamai Cloud · 德国 · 法兰克福](https://speedtest.frankfurt.linode.com/garbage.php?ckSize=1) | 德国 · 法兰克福 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.frankfurt.linode.com/) |
| [Akamai Cloud · 法国 · 巴黎](https://speedtest.paris.linode.com/garbage.php?ckSize=1) | 法国 · 巴黎 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.paris.linode.com/) |
| [Akamai Cloud · 意大利 · 米兰](https://speedtest.milan.linode.com/garbage.php?ckSize=1) | 意大利 · 米兰 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.milan.linode.com/) |
| [Akamai Cloud · 瑞典 · 斯德哥尔摩](https://speedtest.stockholm.linode.com/garbage.php?ckSize=1) | 瑞典 · 斯德哥尔摩 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.stockholm.linode.com/) |
| [Akamai Cloud · 日本 · 大阪](https://speedtest.osaka.linode.com/garbage.php?ckSize=1) | 日本 · 大阪 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.osaka.linode.com/) |
| [Akamai Cloud · 印度尼西亚 · 雅加达](https://speedtest.jakarta.linode.com/garbage.php?ckSize=1) | 印度尼西亚 · 雅加达 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.jakarta.linode.com/) |
| [Akamai Cloud · 印度 · 钦奈](https://speedtest.chennai.linode.com/garbage.php?ckSize=1) | 印度 · 钦奈 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.chennai.linode.com/) |
| [Akamai Cloud · 印度 · 孟买扩展](https://in-bom-2.speedtest.linode.com/garbage.php?ckSize=1) | 印度 · 孟买扩展 | Windows | 动态数据 | 未支持 | [官方来源](https://in-bom-2.speedtest.linode.com/) |
| [Akamai Cloud · 新加坡 · 新加坡](https://speedtest.singapore.linode.com/garbage.php?ckSize=1) | 新加坡 · 新加坡 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.singapore.linode.com/) |
| [Akamai Cloud · 日本 · 东京扩展](https://jp-tyo-3.speedtest.linode.com/garbage.php?ckSize=1) | 日本 · 东京扩展 | Windows | 动态数据 | 未支持 | [官方来源](https://jp-tyo-3.speedtest.linode.com/) |
| [Akamai Cloud · 新加坡 · 新加坡扩展](https://sg-sin-2.speedtest.linode.com/garbage.php?ckSize=1) | 新加坡 · 新加坡扩展 | Windows | 动态数据 | 未支持 | [官方来源](https://sg-sin-2.speedtest.linode.com/) |
| [Akamai Cloud · 印度 · 孟买](https://speedtest.mumbai1.linode.com/garbage.php?ckSize=1) | 印度 · 孟买 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.mumbai1.linode.com/) |
| [Akamai Cloud · 日本 · 东京](https://speedtest.tokyo2.linode.com/garbage.php?ckSize=1) | 日本 · 东京 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.tokyo2.linode.com/) |
| [Leaseweb · 荷兰 · 阿姆斯特丹 AMS-01](http://speedtest.ams1.nl.leaseweb.net/100mb.bin) | 荷兰 · 阿姆斯特丹 AMS-01 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Akamai Cloud · 澳大利亚 · 墨尔本](https://au-mel.speedtest.linode.com/garbage.php?ckSize=1) | 澳大利亚 · 墨尔本 | Windows | 动态数据 | 未支持 | [官方来源](https://au-mel.speedtest.linode.com/) |
| [Leaseweb · 荷兰 · 阿姆斯特丹 AMS-02](http://speedtest.ams2.nl.leaseweb.net/100mb.bin) | 荷兰 · 阿姆斯特丹 AMS-02 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Akamai Cloud · 澳大利亚 · 悉尼](https://speedtest.sydney.linode.com/garbage.php?ckSize=1) | 澳大利亚 · 悉尼 | Windows | 动态数据 | 未支持 | [官方来源](https://speedtest.sydney.linode.com/) |
| [Leaseweb · 德国 · 法兰克福 FRA-01](http://speedtest.fra1.de.leaseweb.net/100mb.bin) | 德国 · 法兰克福 FRA-01 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 英国 · 伦敦 LON-01](http://speedtest.lon1.uk.leaseweb.net/100mb.bin) | 英国 · 伦敦 LON-01 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 美国 · 华盛顿 WDC-02](http://speedtest.wdc2.us.leaseweb.net/100mb.bin) | 美国 · 华盛顿 WDC-02 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 英国 · 伦敦 LON-12](http://speedtest.lon12.uk.leaseweb.net/100mb.bin) | 英国 · 伦敦 LON-12 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 美国 · 旧金山 SFO-12](http://speedtest.sfo12.us.leaseweb.net/100mb.bin) | 美国 · 旧金山 SFO-12 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 美国 · 迈阿密 MIA-11](http://speedtest.mia11.us.leaseweb.net/100mb.bin) | 美国 · 迈阿密 MIA-11 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 美国 · 西雅图 SEA-11](http://speedtest.sea11.us.leaseweb.net/100mb.bin) | 美国 · 西雅图 SEA-11 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 美国 · 凤凰城 PHX-01](http://speedtest.phx1.us.leaseweb.net/100mb.bin) | 美国 · 凤凰城 PHX-01 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 美国 · 达拉斯 DAL-13](http://speedtest.dal13.us.leaseweb.net/100mb.bin) | 美国 · 达拉斯 DAL-13 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 美国 · 芝加哥 CHI-11](http://speedtest.chi11.us.leaseweb.net/100mb.bin) | 美国 · 芝加哥 CHI-11 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 美国 · 纽约 NYC-01](http://speedtest.nyc1.us.leaseweb.net/100mb.bin) | 美国 · 纽约 NYC-01 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 新加坡 · 新加坡 SIN-01](http://speedtest.sin1.sg.leaseweb.net/100mb.bin) | 新加坡 · 新加坡 SIN-01 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 澳大利亚 · 悉尼 SYD-12](http://speedtest.syd12.au.leaseweb.net/100mb.bin) | 澳大利亚 · 悉尼 SYD-12 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 日本 · 东京 TYO-11](http://speedtest.tyo11.jp.leaseweb.net/100mb.bin) | 日本 · 东京 TYO-11 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 中国香港特别行政区 · 香港 HKG-12](http://speedtest.hkg12.hk.leaseweb.net/100mb.bin) | 中国香港特别行政区 · 香港 HKG-12 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [Leaseweb · 加拿大 · 蒙特利尔 MTL-02](http://speedtest.mtl2.ca.leaseweb.net/100mb.bin) | 加拿大 · 蒙特利尔 MTL-02 | Windows | 104.86 MB | 支持 | [官方来源](https://kb.leaseweb.com/kb/network/network-link-speeds/) |
| [OVHcloud · 英国 · 伦敦 Erith](https://lon1-eri.speedtest.network.ovh.net/files/100Mb.dat) | 英国 · 伦敦 Erith | Windows | 104.86 MB | 支持 | [官方来源](https://lon1-eri.speedtest.network.ovh.net) |
| [OVHcloud · 美国 · 弗吉尼亚](https://was1-vin.speedtest.network.ovh.net/files/100Mb.dat) | 美国 · 弗吉尼亚 | Windows | 104.86 MB | 支持 | [官方来源](https://was1-vin.speedtest.network.ovh.net) |
| [OVHcloud · 法国 · 巴黎 CCH](https://par3-cch.speedtest.network.ovh.net/files/100Mb.dat) | 法国 · 巴黎 CCH | Windows | 104.86 MB | 支持 | [官方来源](https://par3-cch.speedtest.network.ovh.net) |
| [OVHcloud · 法国 · 巴黎 MR9](https://par3-mr9.speedtest.network.ovh.net/files/100Mb.dat) | 法国 · 巴黎 MR9 | Windows | 104.86 MB | 支持 | [官方来源](https://par3-mr9.speedtest.network.ovh.net) |
| [OVHcloud · 法国 · 格拉夫林](https://lil2-gra.speedtest.network.ovh.net/files/100Mb.dat) | 法国 · 格拉夫林 | Windows | 104.86 MB | 支持 | [官方来源](https://lil2-gra.speedtest.network.ovh.net) |
| [OVHcloud · 法国 · 鲁贝](https://lil1-rbx.speedtest.network.ovh.net/files/100Mb.dat) | 法国 · 鲁贝 | Windows | 104.86 MB | 支持 | [官方来源](https://lil1-rbx.speedtest.network.ovh.net) |
| [OVHcloud · 法国 · 斯特拉斯堡](https://sxb1-sbg.speedtest.network.ovh.net/files/100Mb.dat) | 法国 · 斯特拉斯堡 | Windows | 104.86 MB | 支持 | [官方来源](https://sxb1-sbg.speedtest.network.ovh.net) |
| [OVHcloud · 美国 · 希尔斯伯勒](https://pdx1-hil.speedtest.network.ovh.net/files/100Mb.dat) | 美国 · 希尔斯伯勒 | Windows | 104.86 MB | 支持 | [官方来源](https://pdx1-hil.speedtest.network.ovh.net) |
| [OVHcloud · 加拿大 · 博阿努瓦](https://ymq1-bhs.speedtest.network.ovh.net/files/100Mb.dat) | 加拿大 · 博阿努瓦 | Windows | 104.86 MB | 支持 | [官方来源](https://ymq1-bhs.speedtest.network.ovh.net) |
| [OVHcloud · 法国 · 巴黎 IEB](https://par3-ieb.speedtest.network.ovh.net/files/100Mb.dat) | 法国 · 巴黎 IEB | Windows | 104.86 MB | 支持 | [官方来源](https://par3-ieb.speedtest.network.ovh.net) |
| [OVHcloud · 澳大利亚 · 悉尼](https://syd1-sy2.speedtest.network.ovh.net/files/100Mb.dat) | 澳大利亚 · 悉尼 | Windows | 104.86 MB | 支持 | [官方来源](https://syd1-sy2.speedtest.network.ovh.net) |
| [OVHcloud · 新加坡 · 新加坡](https://sin1-sgp.speedtest.network.ovh.net/files/100Mb.dat) | 新加坡 · 新加坡 | Windows | 104.86 MB | 支持 | [官方来源](https://sin1-sgp.speedtest.network.ovh.net) |
| [OVHcloud · 印度 · 孟买](https://bom1-ynm1.speedtest.network.ovh.net/files/100Mb.dat) | 印度 · 孟买 | Windows | 104.86 MB | 支持 | [官方来源](https://bom1-ynm1.speedtest.network.ovh.net) |
| [HostHatch · 瑞士 · 苏黎世](https://lg.zrh.hosthatch.com/1GB.test) | 瑞士 · 苏黎世 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.zrh.hosthatch.com/) |
| [HostHatch · 挪威 · 奥斯陆](https://lg.osl.hosthatch.com/1GB.test) | 挪威 · 奥斯陆 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.osl.hosthatch.com/) |
| [HostHatch · 奥地利 · 维也纳](https://lg.vie.hosthatch.com/1GB.test) | 奥地利 · 维也纳 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.vie.hosthatch.com/) |
| [HostHatch · 瑞典 · 斯德哥尔摩](https://lg.sto.hosthatch.com/1GB.test) | 瑞典 · 斯德哥尔摩 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.sto.hosthatch.com/) |
| [HostHatch · 英国 · 伦敦](https://lg.lon.hosthatch.com/1GB.test) | 英国 · 伦敦 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.lon.hosthatch.com/) |
| [HostHatch · 荷兰 · 阿姆斯特丹](https://lg.ams.hosthatch.com/1GB.test) | 荷兰 · 阿姆斯特丹 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.ams.hosthatch.com/) |
| [HostHatch · 美国 · 芝加哥](https://lg.chi.hosthatch.com/1GB.test) | 美国 · 芝加哥 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.chi.hosthatch.com/) |
| [HostHatch · 美国 · 洛杉矶](https://lg.lax.hosthatch.com/1GB.test) | 美国 · 洛杉矶 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.lax.hosthatch.com/) |
| [HostHatch · 美国 · 纽约](https://lg.nyc.hosthatch.com/1GB.test) | 美国 · 纽约 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.nyc.hosthatch.com/) |
| [HostHatch · 日本 · 东京](https://lg.tok.hosthatch.com/1GB.test) | 日本 · 东京 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.tok.hosthatch.com/) |
| [HostHatch · 新加坡 · 新加坡](https://lg.sgp.hosthatch.com/1GB.test) | 新加坡 · 新加坡 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.sgp.hosthatch.com/) |
| [HostHatch · 中国香港特别行政区 · 香港](https://lg.hkg.hosthatch.com/1GB.test) | 中国香港特别行政区 · 香港 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.hkg.hosthatch.com/) |
| [HostHatch · 澳大利亚 · 悉尼](https://lg.syd.hosthatch.com/1GB.test) | 澳大利亚 · 悉尼 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.syd.hosthatch.com/) |
| [HostHatch · 韩国 · 首尔](https://lg.sel.hosthatch.com/1GB.test) | 韩国 · 首尔 | Windows | 1000.00 MB | 支持 | [官方来源](https://lg.sel.hosthatch.com/) |
