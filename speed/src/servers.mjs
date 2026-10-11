// Public download payloads; provenance and compatibility are part of the catalog.
export const SERVER_GROUPS = [
  {
    "id": "telecom",
    "name": "中国电信"
  },
  {
    "id": "unicom",
    "name": "中国联通"
  },
  {
    "id": "mobile",
    "name": "中国移动"
  },
  {
    "id": "broadnet",
    "name": "中国广电"
  },
  {
    "id": "steam",
    "name": "Steam CDN"
  },
  {
    "id": "global",
    "name": "全球测试文件"
  },
  {
    "id": "custom",
    "name": "自定义"
  }
];

export const SERVERS = [
  {
    "kind": "cloudflare",
    "id": "cloudflare",
    "name": "Cloudflare · 自动边缘节点",
    "url": "https://speed.cloudflare.com/__down",
    "group": "global",
    "region": "全球 Anycast",
    "note": "按请求生成指定字节，支持跨域，推荐用于精确配额。",
    "source": "https://speed.cloudflare.com/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "telecom-cloud",
    "name": "中国电信 · 天翼云盘官方下载",
    "url": "https://download.cloud.189.cn/download/client/android/cloud189_v11.1.1_1788507428683.apk",
    "group": "telecom",
    "region": "中国大陆 · 官方 CDN",
    "fileBytes": 387096640,
    "note": "官方稳定入口自动跟随下载跳转；支持 Range，跳转链未开放网页跨域。",
    "source": "https://cloud.189.cn/web/static/download-client/index.html",
    "checkedAt": "2026-10-11",
    "desktopOnly": true
  },
  {
    "kind": "file",
    "id": "telecom-app",
    "name": "中国电信 · 营业厅官方下载",
    "url": "https://appupdates.189.cn/client/ctclientchannel78.apk",
    "group": "telecom",
    "region": "中国大陆 · 官方 CDN",
    "fileBytes": 272035740,
    "desktopOnly": true,
    "note": "电信营业厅官方 APK；支持 Range，未开放 CORS。",
    "source": "https://app.189.cn/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "unicom-cloud",
    "name": "中国联通 · 联通云盘 Windows 文件",
    "url": "https://pack.pan.wo.cn/download/WoCloud-2.8.13.exe",
    "group": "unicom",
    "region": "中国大陆 · 官方 CDN",
    "fileBytes": 452472552,
    "desktopOnly": true,
    "note": "联通云盘官方客户端文件，仅读取数据，不保存或执行。支持 Range，未开放 CORS。",
    "source": "https://pan.wo.cn/client_download",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "unicom-cloud-mac",
    "name": "中国联通 · 联通云盘 Mac 文件",
    "url": "https://pack.pan.wo.cn/download/WoCloud-2.8.13-x64.dmg",
    "group": "unicom",
    "region": "中国大陆 · 官方 CDN",
    "fileBytes": 344982016,
    "desktopOnly": true,
    "note": "联通云盘的另一公开大文件；支持 Range，未开放 CORS。",
    "source": "https://pan.wo.cn/client_download",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "mobile-app",
    "name": "中国移动 · 营业厅官方下载",
    "url": "https://res.app.coc.10086.cn/downfile/apk/CM10086_android_V11.9.2_20250424195533224.apk",
    "group": "mobile",
    "region": "中国大陆 · 官方 CDN",
    "fileBytes": 190491548,
    "desktopOnly": true,
    "note": "中国移动官方客户端文件；支持 Range，未开放 CORS。",
    "source": "https://www.10086.cn/cmccclient/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "broadnet-gdtv",
    "name": "中国广电 · 广东谷豆 TV 下载",
    "url": "https://www.gcable.com.cn/css/GoodTV-AndroidPhone-3.13.0_9226.apk",
    "group": "broadnet",
    "region": "中国大陆 · 广东广电官方",
    "fileBytes": 41726961,
    "desktopOnly": true,
    "referrer": "https://www.gcable.com.cn/gdcp/gdtv/index.html",
    "note": "广东广电官网提供的公开 APK，自动附带官方来源页；支持 Range，未开放 CORS。",
    "source": "https://www.gcable.com.cn/gdcp/gdtv/index.html",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "broadnet-resource",
    "name": "中国广电 · 营业厅公开资源",
    "url": "https://m.10099.com.cn/gwecdq/gWrwMYe20RGkxiCubXa8nc5yN1ldZUIT.jpg",
    "group": "broadnet",
    "region": "中国大陆 · 官方资源 CDN",
    "fileBytes": 212616,
    "note": "官方客户端下载页的公开图片资源，支持跨域及 Range；文件较小，适合连通性和低速消耗。",
    "source": "https://m.10099.com.cn/cbn_client_download.html",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "steam-fastly-package",
    "name": "Steam · Fastly 客户端资源包",
    "url": "https://cdn.fastly.steamstatic.com/client/steamui_websrc_all.zip.399ab78a41fd3867bf178d8bcee57db47a9de0bd",
    "group": "steam",
    "region": "Steam 官方 · Fastly CDN",
    "fileBytes": 30827928,
    "desktopOnly": true,
    "note": "已内置有效的官方客户端资源包链接，无需手填；支持 Range，未开放 CORS。",
    "source": "https://cdn.akamai.steamstatic.com/client/steam_client_win32",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "steam-akamai-package",
    "name": "Steam · Akamai 客户端资源包",
    "url": "https://cdn.akamai.steamstatic.com/client/steamui_websrc_all.zip.399ab78a41fd3867bf178d8bcee57db47a9de0bd",
    "group": "steam",
    "region": "Steam 官方 · Akamai CDN",
    "fileBytes": 30827928,
    "desktopOnly": true,
    "note": "同一官方资源包的 Akamai 入口，可与 Fastly 对比；支持 Range，未开放 CORS。",
    "source": "https://cdn.akamai.steamstatic.com/client/steam_client_win32",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "steam-fastly-installer",
    "name": "Steam · Fastly 官方安装文件",
    "url": "https://cdn.fastly.steamstatic.com/client/installer/SteamSetup.exe",
    "group": "steam",
    "region": "Steam 官方 · Fastly CDN",
    "fileBytes": 2380800,
    "desktopOnly": true,
    "note": "Steam 官网的公开安装文件，用作下载数据，不保存或执行；支持 Range，未开放 CORS。",
    "source": "https://store.steampowered.com/about/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "steam-akamai-installer",
    "name": "Steam · Akamai 官方安装文件",
    "url": "https://cdn.akamai.steamstatic.com/client/installer/SteamSetup.exe",
    "group": "steam",
    "region": "Steam 官方 · Akamai CDN",
    "fileBytes": 2380800,
    "desktopOnly": true,
    "note": "Steam 官方安装文件的 Akamai 入口；支持 Range，未开放 CORS。",
    "source": "https://store.steampowered.com/about/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "cachefly",
    "name": "CacheFly · 100 MB 测试文件",
    "url": "https://cachefly.cachefly.net/100mb.test",
    "group": "global",
    "region": "全球 CDN",
    "fileBytes": 104857600,
    "note": "公开带宽测试文件，支持跨域和 Range。",
    "source": "https://www.cachefly.com/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "vultr-singapore",
    "name": "Vultr · 新加坡 100 MB",
    "url": "https://sgp-ping.vultr.com/vultr.com.100MB.bin",
    "group": "global",
    "region": "新加坡",
    "fileBytes": 104857600,
    "note": "官方公开测试文件，支持跨域和 Range。",
    "source": "https://sgp-ping.vultr.com/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "vultr-tokyo",
    "name": "Vultr · 东京 100 MB",
    "url": "https://hnd-jp-ping.vultr.com/vultr.com.100MB.bin",
    "group": "global",
    "region": "日本东京",
    "fileBytes": 104857600,
    "desktopOnly": false,
    "note": "官方公开测试文件，支持跨域和 Range。",
    "source": "https://hnd-jp-ping.vultr.com/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "ovh",
    "name": "OVHcloud · 法国 100 MB",
    "url": "https://proof.ovh.net/files/100Mb.dat",
    "group": "global",
    "region": "法国",
    "fileBytes": 104857600,
    "desktopOnly": true,
    "note": "公开测试文件，支持 Range，未开放 CORS。",
    "source": "https://proof.ovh.net/",
    "checkedAt": "2026-10-11"
  },
  {
    "kind": "file",
    "id": "custom",
    "name": "自定义 · 完整文件 URL",
    "url": "",
    "group": "custom",
    "region": "自行选择",
    "note": "用于其他公开或有访问权限的 HTTP / HTTPS 文件；Steam 的预置源可直接在上方分类中选择。"
  }
];
