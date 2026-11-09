import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM, CookieJar } from 'jsdom';
import { prepareTheme } from '../../scripts/prepare-theme.mjs';

const script = await readFile(new URL('../theme/client.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function browser({ zone = 'Asia/Kathmandu', at = '2026-11-09T01:14:00Z', url = 'https://lab.yukino.bond/', jar, fail = false, storageBlocked = false } = {}) {
  const dom = new JSDOM('<html><head></head><body><main></main></body></html>', { url, cookieJar: jar, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom; let time = Date.parse(at); const requests = [], intervals = [];
  const observers = [], Observer = window.MutationObserver;
  window.MutationObserver = class extends Observer { constructor(callback) { super(callback); observers.push(this); } };
  window.Date.now = () => time;
  window.setInterval = fn => { intervals.push(fn); return intervals.length; };
  window.fetch = async (url, init) => { requests.push({ url, init }); if (fail) throw new Error('offline'); return { ok: true, json: async () => ({ timeZone: zone, source: 'ip', now: time }) }; };
  if (storageBlocked) {
    window.Storage.prototype.getItem = () => { throw new Error('storage blocked'); };
    window.Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
  }
  window.eval(script); await tick(); await tick();
  return { dom, window, requests, advance: at => { time = Date.parse(at); intervals.forEach(fn => fn()); }, close: async () => { await tick(); await tick(); observers.forEach(observer => observer.disconnect()); dom.window.close(); } };
}
test('IP time zone overrides the device zone, including a 45-minute offset and both switching boundaries', async () => {
  const b = await browser();
  try {
    assert.equal(b.window.YukinoTheme.getState().source, 'ip');
    assert.equal(b.window.YukinoTheme.getState().theme, 'dark');
    b.advance('2026-11-09T01:15:00Z'); assert.equal(b.window.YukinoTheme.getState().theme, 'light');
    b.advance('2026-11-09T13:14:00Z'); assert.equal(b.window.YukinoTheme.getState().theme, 'light');
    b.advance('2026-11-09T13:15:00Z'); assert.equal(b.window.YukinoTheme.getState().theme, 'dark');
    assert.equal(b.requests[0].url, 'https://www.yukino.bond/api/theme');
    assert.equal(b.requests[0].init.credentials, 'omit');
    assert.equal(b.requests[0].init.cache, 'no-store');
  } finally { await b.close(); }
});
test('IANA time zones use summer/winter offsets rather than a fixed UTC offset', async () => {
  const b = await browser({ zone: 'America/New_York' });
  try {
    const themeAt = b.window.YukinoTheme.themeAt;
    assert.equal(themeAt(Date.parse('2026-03-08T10:59:00Z'), 'America/New_York'), 'dark');
    assert.equal(themeAt(Date.parse('2026-03-08T11:00:00Z'), 'America/New_York'), 'light');
    assert.equal(themeAt(Date.parse('2026-11-09T11:59:00Z'), 'America/New_York'), 'dark');
    assert.equal(themeAt(Date.parse('2026-11-09T12:00:00Z'), 'America/New_York'), 'light');
  } finally { await b.close(); }
});
test('manual choices survive automatic updates, travel across subdomains, and can return to automatic', async () => {
  const jar = new CookieJar(), first = await browser({ jar }); let second;
  try {
    first.window.YukinoTheme.setMode('light'); first.advance('2026-11-09T13:15:00Z');
    assert.equal(first.window.YukinoTheme.getState().theme, 'light');
    second = await browser({ jar, url: 'https://cinema.yukino.bond/' });
    assert.equal(second.window.YukinoTheme.getState().mode, 'light');
    second.window.YukinoTheme.setMode('auto'); first.window.dispatchEvent(new first.window.Event('focus'));
    assert.equal(first.window.YukinoTheme.getState().mode, 'auto');
    assert.equal(first.window.YukinoTheme.getState().theme, 'dark');
    second.window.YukinoTheme.setMode('invalid'); assert.equal(second.window.YukinoTheme.getState().mode, 'auto');
  } finally { await first.close(); await second?.close(); }
});
test('failed and invalid IP lookups visibly fall back without breaking storage-restricted pages', async () => {
  for (const options of [{ fail: true, storageBlocked: true }, { zone: 'Not/A-Time-Zone' }]) {
    const b = await browser(options);
    try {
      assert.equal(b.window.YukinoTheme.getState().source, 'browser');
      assert.match(b.window.document.querySelector('yukino-theme-control').shadowRoot.textContent, /设备时区/);
      b.window.YukinoTheme.setMode('dark'); assert.equal(b.window.document.documentElement.dataset.theme, 'dark');
      b.window.eval(script); await tick(); assert.equal(b.window.document.querySelectorAll('yukino-theme-control').length, 1);
    } finally { await b.close(); }
  }
});
test('native startup writes do not override auto; native theme attributes and the whiteboard stay synchronized', async () => {
  const b = await browser();
  try {
    const root = b.window.document.documentElement;
    root.dataset.theme = 'light'; root.dataset.jmTheme = 'light'; root.classList.remove('dark');
    const canvas = b.window.document.createElement('div'); canvas.className = 'excalidraw'; b.window.document.body.append(canvas);
    await tick(); assert.equal(root.dataset.theme, 'dark'); assert.equal(root.dataset.jmTheme, 'dark'); assert.equal(canvas.classList.contains('theme--dark'), true);
    b.window.YukinoTheme.setMode('light'); assert.equal(canvas.classList.contains('theme--dark'), false);
  } finally { await b.close(); }
});
test('theme assets are versioned, idempotent, and work on a game subpath', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yukino-theme-'));
  try {
    await writeFile(join(dir, 'index.html'), '<html><head></head><body></body></html>');
    const first = await prepareTheme(dir, '/fog-harbor-files/'), second = await prepareTheme(dir, '/fog-harbor-files/');
    assert.equal(first.client, second.client);
    const html = await readFile(join(dir, 'index.html'), 'utf8');
    assert.equal((html.match(/data-yukino-theme/g) || []).length, 2);
    assert.match(html, /src="\/fog-harbor-files\/yukino-app-assets\//);
    assert.ok(first.script.includes(first.css)); assert.ok(!first.script.includes('__YUKINO_THEME_CSS__'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('IT Tools native color mode follows automatic changes and its own toggle can select a manual mode', async () => {
  const b = await browser({ url: 'https://tools.yukino.bond/' });
  try {
    assert.equal(b.window.localStorage.getItem('vueuse-color-scheme'), 'dark');
    b.advance('2026-11-09T01:15:00Z');
    assert.equal(b.window.localStorage.getItem('vueuse-color-scheme'), 'light');
    assert.equal(b.window.YukinoTheme.getState().mode, 'auto');
    b.window.dispatchEvent(new b.window.CustomEvent('vueuse-storage', { detail: { key: 'vueuse-color-scheme', newValue: 'dark' } }));
    assert.equal(b.window.YukinoTheme.getState().mode, 'dark');
  } finally { await b.close(); }
});
