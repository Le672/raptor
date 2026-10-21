import { build } from 'vite';
import { fileURLToPath } from 'node:url';
await build({ configFile: fileURLToPath(new URL('../pixiv/vite.config.ts', import.meta.url)) });
