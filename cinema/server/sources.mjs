import { parseFragment } from 'parse5';

import {SOURCES,mediaKind} from './catalog.mjs';
import {isMediaId} from '../shared/source-names.mjs';
export {SOURCES,CATEGORIES} from './catalog.mjs';
export const sourceById = id => SOURCES.find(x => x.id === id);
export function splitId(id) { if(!isMediaId(id))return null;const [source,native]=id.split('-');return {source:sourceById(source),native}; }
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
    // Only these audited public CDNs may use their published nonstandard HTTPS ports.
    const cdnPorts={'kkzycdn.com':'65','hnts.ymuuy.com':'65','c.baisiweiting.com':'18443'};
    if (u.port && !(u.protocol==='https:'&&Object.hasOwn(cdnPorts,host)&&cdnPorts[host]===u.port)) return null;
    return u;
  } catch { return null; }
}
export function mediaAllowed(vod,source){return Boolean(mediaKind(vod,source));}
export function normalize(vod, source) {
  if (!mediaAllowed(vod,source) || !/^[1-9]\d{0,8}$/.test(String(vod.vod_id))) return null;
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
  return { id, mediaKind:mediaKind(vod,source), source: source.id, sourceName: source.name, title: plain(vod.vod_name,200), aliases: plain(vod.vod_sub,500),
    cover: `/api/cover/${id}`, imageUrl: publicUrl(vod.vod_pic)?.href || '', description: plain(vod.vod_content || vod.vod_blurb),
    category: plain(vod.type_name,40), year: plain(vod.vod_year,10).match(/\d{4}/)?.[0]||'', area: plain(vod.vod_area,50), language: plain(vod.vod_lang,50),
    tags: plain(vod.vod_class,200).split(/[,，/]/).filter(Boolean).slice(0,10), actors: plain(vod.vod_actor,500), director: plain(vod.vod_director,200),
    remark: plain(vod.vod_remarks,100), completed: mediaKind(vod,source)==='movie' || Boolean(Number(vod.vod_isend)) || /全\d+集|已完结|全集|完结|^HD|^正片/.test(vod.vod_remarks || ''),
    updatedAt: Number.isFinite(Date.parse(updated + '+08:00')) ? updated + '+08:00' : null,
    score: Number(vod.vod_score) > 0 ? Number(vod.vod_score) : null, episodeCount: Math.max(0,...lines.map(x=>x.episodes.length)), lines };
}
export function summary(media) { const { lines, imageUrl, description, actors, director, ...rest } = media; return rest; }
export function mergeCatalog(items) {
  const merged = new Map();
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[\s·・:：！!\-]/g,'') + '|' + item.year + '|' + item.mediaKind;
    const old = merged.get(key);
    if (old) { if(!old.variants.some(x=>x.id===item.id))old.variants.push({ id: item.id, sourceName: item.sourceName }); if (item.updatedAt > old.updatedAt) old.updatedAt = item.updatedAt; }
    else merged.set(key,{ ...summary(item), variants: [{ id: item.id, sourceName: item.sourceName }] });
  }
  return [...merged.values()].sort((a,b)=>(b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
