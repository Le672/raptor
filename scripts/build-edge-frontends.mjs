import { cp, mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { prepareSiteShell } from './prepare-site-shell.mjs';
const sites = [['speed', 'speed/dist'], ['status', 'dist'], ['tools', 'dist'], ['draw', 'dist'], ['drop']];
const selected = process.argv.find(arg => arg.startsWith('--site='))?.slice(7);
if (selected && !sites.some(([name]) => name === selected)) throw new Error(`Unknown frontend: ${selected}`);
for (const [site, source] of sites) {
  if (selected && selected !== site) continue;
  const root = resolve('.wrangler/edge-frontend', site);
  await mkdir(root, { recursive: true });
  if (source) await cp(source, resolve(root, 'assets'), {
    recursive: true,
    filter: path => !['rail-network', 'f1', 'f1-player', '_redirects', '_worker.js'].includes(basename(path)) && !path.endsWith('.map'),
  });
  await mkdir(resolve(root, 'assets'), { recursive: true });
  const shell = await prepareSiteShell(resolve(root, 'assets'), { inject: false });
  await writeFile(resolve(root, 'wrangler.json'), JSON.stringify({
    name: site === 'draw' ? 'yukino-draw' : 'yukino-' + site + '-edge',
    main: '../../../vps-content/edge-frontend.mjs',
    compatibility_date: '2026-11-03',
    workers_dev: false,
    vars: { SHELL_SCRIPT: shell.script, SHELL_STYLE: shell.style },
    preview_urls: false,
    assets: {
      directory: './assets',
      binding: 'ASSETS',
      not_found_handling: site === 'drop' ? 'none' : 'single-page-application',
      run_worker_first: true,
    },
  }, null, 2));
}
