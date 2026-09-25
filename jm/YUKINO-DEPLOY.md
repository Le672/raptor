# jm.yukino.bond deployment

This directory contains an adapted copy of [TunaFish2K/jmcomic-web-client](https://github.com/TunaFish2K/jmcomic-web-client) (Unlicense). The browser interface supports search, reading, local image caching, chapter range exports to PDF/ZIP/CBZ, PWA installation, and optional local OCR/BYOK translation. The original downloader's batch download workflow inspired the export controls, and this adaptation adds browser-local favorites.

`jm` is an independent pnpm workspace. The workflow at `../.github/workflows/deploy-jm.yml` builds it with Node 22, deploys the API Worker named `jm-api-yukino`, then publishes the frontend to the Cloudflare Pages project `jm-yukino`. Set that Pages project's production branch to `master` so the workflow publishes to the custom domain `jm.yukino.bond`. The Worker uses its in-memory cache; no KV binding is required.

Favorites stay in the current browser. They are not synchronized with the upstream site's account favorites. Desktop-only capabilities such as choosing an arbitrary computer download directory and running a background Tauri process cannot run on Cloudflare Pages. Large exports are assembled in the browser and need available device memory.

To work locally, run `pnpm install` in this directory, start the Worker with `pnpm run worker:dev`, and start the page with `VITE_BACKEND_URL=http://localhost:8787 pnpm run page:dev`. See the upstream README for the full API and client details.
