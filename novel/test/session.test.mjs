import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

test('fresh app instances restore verified sessions, temporary failures preserve the account, and expiration clears it', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://novel.yukino.bond/shelf', pretendToBeVisual: true });
  const restore = [];
  let cleanup = async () => {};
  t.after(async () => { await cleanup(); dom.window.close(); restore.forEach(fn => fn()); });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, location: dom.window.location, Event: dom.window.Event, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key); Object.defineProperty(globalThis, key, { value, configurable: true });
    restore.push(() => { if (old) Object.defineProperty(globalThis, key, old); else delete globalThis[key]; });
  }
  let mode = 'ok', calls = 0, cleared = 0;
  dom.window.addEventListener('novel-session-cleared', () => { cleared++; });
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls++; assert.equal(path, '/api/access'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store');
    if (mode === 'offline') throw new Error('offline');
    return Response.json({ user: mode === 'expired' ? null : { id: 12, name: 'Remembered reader', role: 'user' } });
  });
  const compiled = await build({ stdin: { contents: "export { SessionProvider, AccountControl } from './novel/src/AuthControls.tsx';", resolveDir: fileURLToPath(new URL('../../', import.meta.url)) }, bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', logLevel: 'silent' });
  const code = compiled.outputFiles[0].text.replace(/from "([^".][^"]*)"/g, (_all, specifier) => `from ${JSON.stringify(import.meta.resolve(specifier))}`);
  const { SessionProvider, AccountControl } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const { createElement, act } = await import('react'), { createRoot } = await import('react-dom/client'), { MemoryRouter } = await import('react-router-dom');
  const mount = async () => {
    const root = createRoot(dom.window.document.getElementById('app')); cleanup = async () => { await act(() => root.unmount()); };
    await act(async () => root.render(createElement(MemoryRouter, null, createElement(SessionProvider, null, createElement(AccountControl)))));
  };
  await mount(); assert.match(dom.window.document.body.textContent, /Remembered reader/); const first = calls;
  await cleanup(); await mount(); assert.ok(calls > first); assert.match(dom.window.document.body.textContent, /Remembered reader/);
  assert.equal(dom.window.localStorage.length, 0);
  mode = 'offline'; await act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')));
  assert.match(dom.window.document.body.textContent, /Remembered reader.*待验证/);
  mode = 'expired'; await act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')));
  assert.equal(dom.window.document.body.textContent, '登录'); assert.ok(cleared > 0);
});
