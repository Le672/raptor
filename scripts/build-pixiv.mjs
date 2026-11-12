import { build } from 'vite';
import { fileURLToPath } from 'node:url';
await build({ configFile: fileURLToPath(new URL('../pixiv/vite.config.ts', import.meta.url)) });

const { preparePwa } = await import('./prepare-pwa.mjs');
await preparePwa(new URL('../pixiv/dist/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), 'pixiv');
