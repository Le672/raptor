// Public website origins only. API/mail transport hosts are not applications.
const sections = [
  ['www', 'Yukino', '日常与故事的入口', 'Home'],
  ['dev', 'Yukino 开发工具', '开发工具', 'Dev'], ['blog', 'Yukino 博客', '博客', 'Blog'],
  ['box', 'Yukino 资源箱', '资源箱', 'Box'], ['links', 'Yukino 导航', '导航', 'Links'],
  ['about', '关于 Yukino', '关于', 'AboutMe'], ['uses', 'Yukino 设备清单', '设备清单', 'Uses'],
  ['changelog', 'Yukino 更新日志', '更新日志', 'Changelog'], ['friends', 'Yukino 友链', '友链', 'Friends'],
  ['rss', 'Yukino 订阅', '订阅', 'RSS'], ['lab', 'Yukino 实验室', '实验室', 'Lab'],
  ['games', 'Yukino 游戏', '小游戏', 'Games'], ['focus', 'Yukino 专注', '专注', 'Focus'],
  ['news', 'Yukino 新闻', '新闻', 'News'], ['cr', 'Yukino 铁路', '铁路', 'Rail'],
  ['f1', 'Yukino F1', 'F1', 'F1'], ['ip', 'Yukino IP', 'IP 查询', 'Ip'],
];
export const PORTAL_APPS = sections.map(([id, name, short, chunk]) => ({ id, name, short, chunk, auth: 'portal', group: 'portal' }));
export const APPS = [
  ...PORTAL_APPS,
  { id: 'status', name: 'Yukino 服务状态', short: '服务状态', chunk: 'Status', group: 'portal', auth: 'none' },
  { id: 'speed', name: 'Yukino Speed', short: '网络测速', group: 'content', auth: 'none' },
  { id: 'jm', name: 'Yukino 姬漫', short: '姬漫', group: 'jm', auth: 'source' },
  { id: 'pixiv', name: 'Yukino Pixiv 画廊', short: 'Pixiv 画廊', group: 'pixiv', auth: 'none' },
  { id: 'ln', name: 'Yukino 轻小说书房', short: '轻小说书房', group: 'novel', auth: 'content' },
  { id: 'novel', name: 'Yukino 小说书房', short: '小说书房', group: 'novel', auth: 'content' },
  { id: 'comic', name: 'Yukino 番剧放映室', short: '番剧放映室', group: 'content', auth: 'content' },
  { id: 'cinema', name: 'Yukino 影视馆', short: '影视馆', group: 'content', auth: 'content' },
  { id: 'mail', name: 'Yukino Mail', short: 'Yukino 邮箱', group: 'mail', auth: 'mail', bridge: true },
  { id: 'tools', name: 'Yukino 开发者抽屉', short: '开发者抽屉', group: 'gateway', auth: 'owner', bridge: true },
  { id: 'draw', name: 'Yukino 随手画布', short: '随手画布', group: 'gateway', auth: 'none', bridge: true },
  { id: 'drop', name: 'Yukino 临时传送门', short: '临时传送门', group: 'gateway', auth: 'upload', onlineOnly: true },
].map(app => ({ ...app, host: `${app.id}.yukino.bond`, color: '#edf5fc' }));
export function appForHost(hostname) { return APPS.find(app => app.host === hostname || (hostname === 'yukino.bond' && app.id === 'www')); }
export function appManifest(app, icons) {
  return { id: '/', name: app.name, short_name: app.short, description: `${app.name}，安装到手机、平板或电脑。`, lang: 'zh-CN',
    start_url: '/', scope: '/', display: 'standalone', display_override: ['standalone', 'minimal-ui'],
    background_color: '#f8fafc', theme_color: app.color, prefer_related_applications: false,
    icons: [
      { src: icons[192], sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icons[512], sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
