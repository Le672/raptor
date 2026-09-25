import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { ORT_MJS_ASSET_PATH, ORT_WASM_GZIP_ASSET_PATH } from './src/translation/ort-assets';

const require = createRequire(import.meta.url);
const wasm = require.resolve('onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm');
const mjs = require.resolve('onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs');

export default defineConfig({
  base: '/',
  resolve: {
    conditions: ['onnxruntime-web-use-extern-wasm', 'module', 'browser', 'development|production'],
  },
  define: { __APP_RELEASE_ID__: JSON.stringify('desktop') },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'desktop-ort-runtime',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: ORT_WASM_GZIP_ASSET_PATH.slice(1), source: gzipSync(readFileSync(wasm), { level: 9 }) });
        this.emitFile({ type: 'asset', fileName: ORT_MJS_ASSET_PATH.slice(1), source: readFileSync(mjs) });
      },
    },
  ],
  build: {
    outDir: resolve(__dirname, '../../desktop/dist'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(__dirname, 'desktop.html') },
  },
});
