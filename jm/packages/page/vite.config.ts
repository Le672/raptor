import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const ortModule = require.resolve('onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs');

export default defineConfig({
  plugins: [react(), {
    name: 'offline-shell-and-compressed-wasm',
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type === 'asset' && asset.fileName.endsWith('.wasm')) {
          const bytes = typeof asset.source === 'string' ? Buffer.from(asset.source) : Buffer.from(asset.source);
          asset.source = gzipSync(bytes, { level: 9 });
        }
      }
      const precache = ['/index.html', '/book-icon.svg', ...Object.keys(bundle).filter(name =>
        name.endsWith('.js') || name.endsWith('.css'),
      ).filter(name => !name.includes('worker-entry') && !name.includes('ort.bundle') && !name.includes('/dist-')).map(name => `/${name}`)];
      const template = readFileSync(resolve(__dirname, 'sw-template.js'), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template.replace('__PRECACHE__', JSON.stringify(precache)) });
      this.emitFile({ type: 'asset', fileName: 'assets/ocr-runtime.mjs', source: readFileSync(ortModule) });
    },
  }],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        assetFileNames: asset => asset.names.some(name => name.endsWith('.wasm')) ? 'assets/ocr-runtime.wasm' : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
