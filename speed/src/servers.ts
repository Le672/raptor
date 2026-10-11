export type Server = { id: string; name: string; url: string; httpUrl?: string; kind: 'cloudflare' | 'file'; region: string; note: string; desktopOnly?: boolean };
export const SERVERS: Server[] = [
  { id: 'cloudflare', name: 'Cloudflare · 全球 Anycast', url: 'https://speed.cloudflare.com/__down', kind: 'cloudflare', region: '自动就近', note: '按请求生成指定大小的测试数据；推荐用于流量配额与带宽限制。' },
  { id: 'hetzner', name: 'Hetzner · 德国', url: 'https://fsn1-speed.hetzner.com/100MB.bin', kind: 'file', region: 'Falkenstein', note: '公开测试文件；网页版可用性取决于服务器 CORS。' },
  { id: 'ovh', name: 'OVHcloud · 法国', url: 'https://proof.ovh.net/files/100Mb.dat', kind: 'file', region: 'Roubaix', note: '公开测试文件；网络故障可切换其他节点。' },
  { id: 'tele2', name: 'Tele2 · 运营商文件服务器', url: 'http://speedtest.tele2.net/100MB.zip', kind: 'file', region: '欧洲', note: 'HTTP 测试文件，请使用 Windows 版。', desktopOnly: true },
  { id: 'steam', name: 'Steam / 游戏 CDN · 自定义文件', url: '', kind: 'file', region: '自行指定', note: '粘贴拥有访问权限的完整游戏 CDN 文件链接；域名本身不是下载文件。Windows 版可连接无 CORS 的 CDN。' },
  { id: 'custom', name: '自定义 · HTTP / HTTPS 文件', url: '', kind: 'file', region: '自行指定', note: '支持运营商、Speedtest 文件接口和其他测试文件。仅用于有权访问的下载链接。' },
];
