import { parseFragment } from 'parse5';

export const SOURCES = [
  { id: 'ikun', name: 'iKun', api: 'https://ikunzyapi.com/api.php/provide/vod/', home: 'https://www.ikunzy.cc/', categories: { jp: 37, cn: 35, west: 36, movie: 22 }, allowed: [22,35,36,37] },
  { id: 'bf', name: '暴风', api: 'https://bfzyapi.com/api.php/provide/vod/', home: 'https://bfzy.tv/', categories: { jp: 41, cn: 40, west: 42, movie: 50 }, allowed: [39,40,41,42,43,44,50] },
  { id: 'ff', name: '非凡', api: 'https://api.ffzyapi.com/api.php/provide/vod/', home: 'https://ffzy.tv/', categories: { jp: 30, cn: 29, west: 31 }, allowed: [4,29,30,31,32,33] },
  { id: 'lz', name: '量子', api: 'https://cj.lziapi.com/api.php/provide/vod/', home: 'https://lzizy.com/', categories: { jp: 30, cn: 29, west: 31, movie: 49 }, allowed: [4,29,30,31,32,33,49] },
];
export const CATEGORIES = { all: '全部番剧', jp: '日韩动漫', cn: '国产动漫', west: '欧美动漫', movie: '动画电影' };
export const sourceById = id => SOURCES.find(x => x.id === id);
export function splitId(id) { const m = /^(bf|ff|lz|ikun)-([1-9]\d{0,8})$/.exec(id || ''); return m ? { source: sourceById(m[1]), native: m[2] } : null; }
export function plain(input, limit = 4000) {
  const tree = parseFragment(String(input || '').slice(0, 50000));
  const walk = node => ['script','style'].includes(node.tagName) ? '' : node.nodeName === '#text' ? node.value : (node.childNodes || []).map(walk).join(['p','br','div'].includes(node.tagName) ? '\n' : '');
  return walk(tree).replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi,entity=>walk(parseFragment(entity))).replace(/\u00a0/g, ' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim().slice(0,limit);
}
export function publicUrl(input) {
  try {
    const u = new URL(input);
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password || u.href.length > 4096) return null;
    const host = u.hostname.toLowerCase();
    // Only DNS names can enter the media path. IP literals and internal names are never fetched.
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/.test(host)) return null;
    // This public CDN serves iKun's real HLS segments on HTTPS port 65.
    if (u.port && !(u.protocol==='https:'&&host==='kkzycdn.com'&&u.port==='65')) return null;
    return u;
  } catch { return null; }
}
export function animeAllowed(vod, source) { return source.allowed.includes(Number(vod.type_id)) && /动漫|动画片/.test(vod.type_name || '') && !/里番|伦理|成人|写真/.test(vod.type_name || ''); }
export function normalize(vod, source) {
  if (!animeAllowed(vod,source) || !/^[1-9]\d{0,8}$/.test(String(vod.vod_id))) return null;
  const id = `${source.id}-${vod.vod_id}`, names = String(vod.vod_play_from || '').split('$$$');
  const lines = String(vod.vod_play_url || '').split('$$$').map((line, index) => ({
    id: String(index), name: source.name + (names.length > 2 ? ` ${index + 1}` : '') + ' · HLS',
    episodes: line.split('#').flatMap((part, i) => {
      const separator = part.indexOf('$'); if (separator < 0) return [];
      const url = publicUrl(part.slice(separator + 1));
      if (!url || !/\.(?:m3u8|mp4|m4v)(?:$|\?)/i.test(url.href)) return [];
      return [{ id: String(i), title: plain(part.slice(0,separator),100) || `第 ${i + 1} 集`, url: url.href, kind: /\.m3u8(?:$|\?)/i.test(url.href) ? 'hls' : 'mp4' }];
    }).slice(0,5000),
  })).filter(line => line.episodes.length);
  const updated = String(vod.vod_time || '').replace(' ','T');
  return { id, source: source.id, sourceName: source.name, title: plain(vod.vod_name,200), aliases: plain(vod.vod_sub,500),
    cover: `/api/cover/${id}`, imageUrl: publicUrl(vod.vod_pic)?.href || '', description: plain(vod.vod_content || vod.vod_blurb),
    category: plain(vod.type_name,40), year: plain(vod.vod_year,10).match(/\d{4}/)?.[0]||'', area: plain(vod.vod_area,50), language: plain(vod.vod_lang,50),
    tags: plain(vod.vod_class,200).split(/[,，/]/).filter(Boolean).slice(0,10), actors: plain(vod.vod_actor,500), director: plain(vod.vod_director,200),
    remark: plain(vod.vod_remarks,100), completed: Boolean(Number(vod.vod_isend)) || /全\d+集|已完结|全集|完结|^HD|^正片/.test(vod.vod_remarks || ''),
    updatedAt: Number.isFinite(Date.parse(updated + '+08:00')) ? updated + '+08:00' : null,
    score: Number(vod.vod_score) > 0 ? Number(vod.vod_score) : null, episodeCount: Math.max(0,...lines.map(x=>x.episodes.length)), lines };
}
export function summary(anime) { const { lines, imageUrl, description, actors, director, ...rest } = anime; return rest; }
export function mergeCatalog(items) {
  const merged = new Map();
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[\s·・:：！!\-]/g,'') + '|' + item.year;
    const old = merged.get(key);
    if (old) { old.variants.push({ id: item.id, sourceName: item.sourceName }); if (item.updatedAt > old.updatedAt) old.updatedAt = item.updatedAt; }
    else merged.set(key,{ ...summary(item), variants: [{ id: item.id, sourceName: item.sourceName }] });
  }
  return [...merged.values()].sort((a,b)=>(b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
