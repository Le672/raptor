# Shared automatic appearance

All 29 public app domains, plus the apex domain, use the same auto/light/dark preference. `functions/api/theme.ts` reads Cloudflare's trusted `request.cf.timezone`. It returns only the IANA time zone and server time, with private/no-store headers and CORS limited to the site's HTTPS origins. There are no database writes or third-party geolocation requests.

Auto uses local 07:00–19:00 as the light period. `Intl.DateTimeFormat` applies DST and fractional offsets. The client checks every 30 seconds, on focus/visibility, and on reconnect; it refreshes the IP location every 15 minutes. A failed lookup explicitly falls back to the device's time zone. A public domain cookie carries manual choices between subdomains; storage is optional.

`prepare-pwa.mjs` includes the runtime and style asset in each installable app. `prepare-theme.mjs` covers the readers and game subpaths without changing their service workers. Native React controls subscribe through the small bridge; the shared control always offers a return to auto.

After changing portal CSS, run `node scripts/build-theme-palette.mjs` and review `portal-dark.css`. These overrides affect CSS colors within `.site-refresh`; media, artwork images, video pixels, and map tiles retain their source colors. Application-specific rules live in `style.css`.

Validate with `node --test shared/test/theme.test.mjs shared/test/pwa.test.mjs` and the regular website tests/builds. `scripts/deploy-theme-vps.py` publishes frontend assets only, backs up the gateway configuration, checks Nginx and content service health, and rolls back failures. Prepare `.wrangler/theme-gateway/theme.json` with `themeAssets()` before running it. Mail, JM, Pixiv and the portal retain their existing Cloudflare workflows.
