import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { addMailAppearance, mailAppearanceBridge } from '../../scripts/prepare-mail-theme.mjs';
test('mailbox patch is idempotent and refuses an unrecognized initialization', () => {
  const source = 'const pinia = createPinia();\nconst app = createApp(App).use(pinia);\nawait init()\napp.mount("#app");';
  const result = addMailAppearance(source);
  assert.equal(addMailAppearance(result), result);
  assert.ok(result.indexOf('const appearanceUi') < result.indexOf('await init()'));
  assert.throws(() => addMailAppearance('unknown source'), /initialization changed/);
});
test('automatic mailbox changes keep auto selected while the native toggle sets a manual preference', () => {
  let subscriber, nativeDark = false, theme = 'dark'; const choices = [], events = {};
  const ui = { $subscribe(fn) { subscriber = fn; } };
  Object.defineProperty(ui, 'dark', { get: () => nativeDark, set: value => { nativeDark = value; subscriber?.({}, ui); } });
  runInNewContext(mailAppearanceBridge, { pinia: {}, useAppearanceUiStore: () => ui, window: {
    YukinoTheme: { getState: () => ({ theme }), setMode: value => { theme = value; choices.push(value); } },
    addEventListener: (name, fn) => { events[name] = fn; },
  } });
  assert.equal(ui.dark, true); assert.deepEqual(choices, []);
  theme = 'light'; events['yukino-theme-change'](); assert.equal(ui.dark, false); assert.deepEqual(choices, []);
  ui.dark = true; assert.deepEqual(choices, ['dark']);
});
