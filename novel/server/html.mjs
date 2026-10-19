import { parse, serialize } from 'parse5';
export const document = html => parse(String(html));
export const attr = (node, name) => node?.attrs?.find(item => item.name === name)?.value || '';
export const hasClass = (node, value) => attr(node, 'class').split(/\s+/).includes(value);
export function all(root, predicate) {
  const found = [];
  function visit(node) { if (!node) return; if (predicate(node)) found.push(node); for (const child of node.childNodes || []) visit(child); }
  visit(root); return found;
}
export const cls = (root, value) => all(root, node => hasClass(node, value));
export const tag = (root, value) => all(root, node => node.tagName === value);
export const byId = (root, value) => all(root, node => attr(node, 'id') === value)[0];
export function text(root, lines = false) {
  if (!root || ['script', 'style', 'template', 'noscript'].includes(root.tagName)) return '';
  if (root.nodeName === '#text') return root.value || '';
  if (root.tagName === 'br') return lines ? '\n' : ' ';
  const value = (root.childNodes || []).map(node => text(node, lines)).join('');
  return lines && ['p', 'div', 'li', 'h1', 'h2', 'h3'].includes(root.tagName) ? value + '\n' : value;
}
export const clean = root => text(root).replace(/\s+/g, ' ').trim();
export const content = root => root ? serialize(root) : '';
export function dateTime(input) {
  const match = String(input || '').match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?(?:[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) return null;
  const [, y, m, d, h = '00', min = '00', s = '00'] = match;
  const value = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${min.padStart(2,'0')}:${s.padStart(2,'0')}+08:00`;
  return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}
