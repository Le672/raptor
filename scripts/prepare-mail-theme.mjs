import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Pinia owns the native mailbox theme button. Keep it synchronized without
// reading account state or turning an automatic change into a manual choice.
export const mailAppearanceBridge = `
/* YUKINO_SHARED_APPEARANCE */
const appearanceUi = useAppearanceUiStore(pinia);
if (window.YukinoTheme) {
  let appearanceSyncing = false;
  const syncAppearance = () => {
    appearanceSyncing = true;
    appearanceUi.dark = window.YukinoTheme.getState().theme === 'dark';
    appearanceSyncing = false;
  };
  appearanceUi.$subscribe((_mutation, state) => {
    if (!appearanceSyncing && state.dark !== (window.YukinoTheme.getState().theme === 'dark')) {
      window.YukinoTheme.setMode(state.dark ? 'dark' : 'light');
    }
  }, { flush: 'sync' });
  window.addEventListener('yukino-theme-change', syncAppearance);
  syncAppearance();
}
`;
export function addMailAppearance(source) {
  if (source.includes('/* YUKINO_SHARED_APPEARANCE */')) return source;
  if (!source.includes('const pinia =') || !source.includes('await init()')) throw new Error('Mailbox initialization changed; review theme bridge before building');
  return `import { useUiStore as useAppearanceUiStore } from '@/store/ui.js';\n` + source.replace('await init()', mailAppearanceBridge + '\nawait init()');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const path = resolve('mailbox/mail-vue/src/main.js');
  await writeFile(path, addMailAppearance(await readFile(path, 'utf8')));
  console.log('Mailbox native appearance control connected to shared auto mode.');
}
