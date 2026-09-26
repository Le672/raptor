# Yukino JM

Yukino JM is an independently written comic reading application for Cloudflare Pages, Cloudflare Workers, and Windows Electron. The two public JM projects referenced during planning were used only to identify product features and upstream protocol behavior. Their application source is not included in this working tree.

## Features

- Search by title, creator, or tag, with category, order, and time filters; open a work directly by ID.
- Read single works and chapter collections in vertical or horizontal mode, with zoom and progress.
- Save favorites and reading position locally. Previously opened metadata and pages remain available through browser caches; the web app shell is installable as a PWA.
- Export a chapter or a selected group of chapters as CBZ, ZIP, or PDF with up to four concurrent image fetches.
- Optional on-device PaddleOCR extraction and translation through a user-supplied OpenAI-compatible endpoint.
- Dedicated dark desktop layout packaged as a Windows portable executable.

## Development

Run `pnpm install` in this directory, then `pnpm worker:dev` and `VITE_BACKEND_URL=http://127.0.0.1:8787 pnpm web:dev` in separate terminals. Run `pnpm web:build` and `pnpm desktop:build` for release assets.

The upstream service is unaffiliated with Yukino JM and may change its protocol or availability. Third-party npm packages retain their own licenses.
