import { cp, mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

for (const [site, source] of [['speed', 'speed/dist'], ['status', 'dist'], ['tools'], ['drop']]) {
  const root = resolve('.wrangler/edge-frontend', site);
  await mkdir(root, { recursive: true });
  if (source) await cp(source, resolve(root, 'assets'), {
    recursive: true,
    filter: path => !['rail-network', 'f1', 'f1-player', '_redirects', '_worker.js'].includes(basename(path)) && !path.endsWith('.map'),
  });
  await writeFile(resolve(root, 'wrangler.json'), JSON.stringify({
    name: 'yukino-' + site + '-edge',
    main: '../../../vps-content/edge-frontend.mjs',
    compatibility_date: '2026-11-03',
    workers_dev: false,
    preview_urls: false,
    assets: {
      directory: './assets',
      binding: 'ASSETS',
      not_found_handling: site === 'drop' ? 'none' : 'single-page-application',
      run_worker_first: source ? ['/api', '/api/*'] : true,
    },
  }, null, 2));
}
