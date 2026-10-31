// The legacy Pages origin only redirects to the independent VPS. Build in an
// isolated directory so the main site's Functions can never be attached here.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const repo = fileURLToPath(new URL('..', import.meta.url));
const root = resolve(repo, '.wrangler/speed-retired');
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/_redirects'), '/* https://speed.yukino.bond/:splat 307\n');
await writeFile(resolve(root, 'dist/index.html'), '<!doctype html><meta charset="utf-8"><title>Yukino Speed</title><a href="https://speed.yukino.bond/">Yukino Speed</a>');
await writeFile(resolve(root, 'wrangler.toml'), 'name = "yukino-speed"\ncompatibility_date = "2026-10-11"\npages_build_output_dir = "dist"\n');
if (process.argv.includes('--deploy')) {
  const result = spawnSync(process.execPath, [resolve(repo, 'node_modules/wrangler/bin/wrangler.js'), 'pages', 'deploy', 'dist', '--project-name=yukino-speed', '--branch=master', '--commit-dirty=true'], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} else console.log('Legacy Speed redirect bundle ready. Use --deploy with existing Pages credentials to publish it.');
