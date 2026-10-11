import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Web deep links need root assets; file:// desktop builds need relative assets.
  base: mode === 'desktop' ? './' : '/',
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { proxy: { '/api/rail': { target: 'https://www.yukino.bond', changeOrigin: true }, '/api/f1': { target: 'http://127.0.0.1:8788', changeOrigin: true } } },
  build: {
    sourcemap: 'hidden',
    rollupOptions: { input: { web: 'index.html', desktop: 'desktop.html' } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
}))
