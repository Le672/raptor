import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), plugins: [react()], build: { outDir: 'dist', emptyOutDir: true }, server: { host: '127.0.0.1', port: 5186, proxy: { '/api': 'http://127.0.0.1:8789' } } });
