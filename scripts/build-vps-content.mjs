import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build as viteBuild } from 'vite';
import { preparePwa } from './prepare-pwa.mjs';
if (process.argv.includes('--build')) {
  const check = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b', '--noEmit'], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status || 1);
}
if (process.argv.includes('--build')) for (const name of ['cinema', 'comic', 'novel']) {
  for (const args of [['node_modules/typescript/bin/tsc', '-p', `${name}/tsconfig.json`], [`scripts/build-${name}.mjs`]]) {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
if (process.argv.includes('--build')) await viteBuild({ root: resolve('speed'), configFile: resolve('speed/vite.config.ts') });
if (process.argv.includes('--build')) await viteBuild({ configFile: resolve('vite.config.ts') });
await preparePwa(resolve('dist'), 'portal');
await preparePwa(resolve('speed/dist'), 'speed');
const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = resolve('.wrangler/vps-content');
if (root !== resolve(repository, '.wrangler', 'vps-content') || !root.startsWith(repository + sep)) throw new Error('Unexpected build destination');
// Clear only this reproducible bundle so removed files cannot reach a release.
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
for (const name of ['cinema', 'comic', 'novel']) {
  await build({ entryPoints: [`${name}/server/worker.mjs`], outfile: `${root}/${name}/worker.mjs`, bundle: true, platform: 'node', target: 'node22', format: 'esm' });
  await cp(`${name}/dist`, `${root}/${name}/dist`, { recursive: true });
}
await build({ entryPoints: ['vps-content/speed-worker.mjs'], outfile: `${root}/speed/worker.mjs`, bundle: true, platform: 'node', target: 'node22', format: 'esm' });
await cp('speed/dist', `${root}/speed/dist`, { recursive: true });
await build({ entryPoints: ['vps-content/status-worker.mjs'], outfile: `${root}/status/worker.mjs`, bundle: true, platform: 'node', target: 'node22', format: 'esm' });
await cp('dist', `${root}/status/dist`, { recursive: true, filter: name => !name.endsWith('.map') &&
  !['rail-network', 'f1', 'f1-player'].some(directory => resolve(name) === resolve('dist', directory) || resolve(name).startsWith(resolve('dist', directory) + '/')) });
await cp('vps-content', `${root}/vps-content`, { recursive: true, filter: name => !name.endsWith('.test.mjs') && !name.endsWith('.pyc') && !name.includes('__pycache__') });
await cp('node_modules/undici', `${root}/node_modules/undici`, { recursive: true });
const version = { builtAt: new Date().toISOString(), storage: 'local-sqlite', sites: ['cinema', 'comic', 'novel', 'speed', 'status'],
  node: '22.23.4', dependencies: { undici: JSON.parse(await readFile('node_modules/undici/package.json', 'utf8')).version } };
await writeFile(`${root}/version.json`, JSON.stringify(version, null, 2));
console.log(`VPS content bundle ready: ${root}`);
