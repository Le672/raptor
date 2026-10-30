import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
if (process.argv.includes('--build')) for (const name of ['cinema', 'comic', 'novel']) {
  for (const args of [['node_modules/typescript/bin/tsc', '-p', `${name}/tsconfig.json`], [`scripts/build-${name}.mjs`]]) {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
const root = resolve('.wrangler/vps-content');
await mkdir(root, { recursive: true });
for (const name of ['cinema', 'comic', 'novel']) {
  await build({ entryPoints: [`${name}/server/worker.mjs`], outfile: `${root}/${name}/worker.mjs`, bundle: true, platform: 'node', target: 'node22', format: 'esm' });
  await cp(`${name}/dist`, `${root}/${name}/dist`, { recursive: true });
}
await cp('vps-content', `${root}/vps-content`, { recursive: true, filter: name => !name.endsWith('.test.mjs') });
await cp('node_modules/undici', `${root}/node_modules/undici`, { recursive: true });
const version = { builtAt: new Date().toISOString(), storage: 'local-sqlite', sites: ['cinema', 'comic', 'novel'],
  node: '22.23.4', dependencies: { undici: JSON.parse(await readFile('node_modules/undici/package.json', 'utf8')).version } };
await writeFile(`${root}/version.json`, JSON.stringify(version, null, 2));
console.log(`VPS content bundle ready: ${root}`);
