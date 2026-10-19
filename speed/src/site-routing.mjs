// Shared by the portal, the independent speed deployment and their edge routers.
export const MAIN_ORIGIN = 'https://www.yukino.bond';
export const SITE_SECTIONS = [
  ['/dev', 'dev'], ['/blog', 'blog'], ['/box', 'box'], ['/links', 'links'],
  ['/about-me', 'about'], ['/uses', 'uses'], ['/changelog', 'changelog'],
  ['/friends', 'friends'], ['/rss', 'rss'], ['/lab', 'lab'], ['/status', 'status'],
  ['/games', 'games'], ['/focus', 'focus'], ['/news', 'news'], ['/cr', 'cr'],
  ['/f1', 'f1'], ['/speed', 'speed'], ['/ip', 'ip'], ['/jm', 'jm'], ['/novel', 'novel'], ['/mail', 'mail'],
];
export const PORTAL_HOSTS = ['yukino.bond', 'www.yukino.bond', ...SITE_SECTIONS.filter(([, name]) => !['jm', 'novel', 'mail'].includes(name)).map(([, name]) => name + '.yukino.bond')];
export const SUBDOMAIN_ROUTES = Object.fromEntries(SITE_SECTIONS.filter(([, name]) => !['cr', 'speed', 'jm', 'novel', 'mail'].includes(name)).map(([path, name]) => [name, path]));
const RAIL_PATHS = ['/ticket', '/transfer', '/live', '/arrivalinfo'];
const reserved = path => /^\/(?:api|assets|rail-network|\.well-known)(?:\/|$)/.test(path) || /\.[a-z0-9]+$/i.test(path);
export function isPortalHost(hostname) { return PORTAL_HOSTS.includes(hostname.toLowerCase()); }
export function isMainHost(hostname) { return ['www.yukino.bond', 'yukino.bond'].includes(hostname.toLowerCase()); }
export function isLocalHost(hostname) { return ['localhost', '127.0.0.1', '[::1]'].includes(hostname); }
export function canonicalPageUrl(input) {
  const url = new URL(input);
  if (!isPortalHost(url.hostname) || !['http:', 'https:'].includes(url.protocol) || reserved(url.pathname)) return null;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  // A subsite's own root is its landing page; an explicit link to '/' means the main homepage.
  if (path === '/' && !isMainHost(url.hostname)) { url.protocol = 'https:'; return url.href; }
  const section = SITE_SECTIONS.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'));
  const name = RAIL_PATHS.includes(path) ? 'cr' : section?.[1];
  url.protocol = 'https:'; url.port = ''; url.hostname = name ? name + '.yukino.bond' : 'www.yukino.bond';
  if (section && ['speed', 'jm', 'novel', 'mail'].includes(name)) url.pathname = url.pathname.slice(section[0].length) || '/';
  return url.href;
}
export function siteHref(path, hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname) {
  if (!isPortalHost(hostname)) return path;
  const url = new URL(path, MAIN_ORIGIN);
  const target = canonicalPageUrl(url.href) || url.href;
  const parsed = new URL(target);
  return parsed.hostname === hostname && parsed.protocol === 'https:' ? parsed.pathname + parsed.search + parsed.hash : target;
}
