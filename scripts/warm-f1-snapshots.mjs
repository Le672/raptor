import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Real public Jolpica records provide a cold-start fallback when the edge egress is throttled.
// This runs once during the existing deployment; it never creates a scheduled job.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = path.join(root, 'functions/_data/f1-snapshots.json');
const outfile = path.join(root, '.wrangler/f1-cache-warmer.cjs');
await fs.mkdir(path.dirname(outfile), { recursive: true });
await build({ entryPoints: [path.join(root, 'functions/api/f1.ts')], outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node22', logLevel: 'error' });
const { onRequestGet } = createRequire(import.meta.url)(outfile);
const snapshots = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
const year = new Date().getUTCFullYear();
const cases = [
  { action: 'season', year }, { action: 'season', year: year - 1 },
  ...['results', 'qualifying', 'sprint'].map(kind => ({ action: 'results', year, kind })),
  { action: 'leclerc', year },
];
for (const query of cases) {
  const params = new URLSearchParams({ action: query.action, year: String(query.year), round: 'last', kind: query.kind || 'results', session: 'latest', drivers: '' });
  const key = params.toString();
  const response = await onRequestGet({ request: new Request('https://f1.yukino.bond/api/f1?' + key), env: { F1_CACHE_WARMUP: true } });
  const payload = await response.json();
  if (response.ok && !payload.errors?.length && !payload.unavailable) {
    snapshots[key] = payload;
    console.log(`Verified F1 snapshot: ${query.action}/${query.year}/${query.kind || 'results'} at ${payload.fetchedAt}`);
  } else console.warn(`F1 source unavailable for ${query.action}/${query.year}; preserving its last verified snapshot.`);
  await new Promise(resolve => setTimeout(resolve, 600));
}
await fs.writeFile(snapshotPath, JSON.stringify(snapshots) + '\n');
if (!Object.values(snapshots).some(value => value.year === year && Array.isArray(value.races) && value.races.length)) throw new Error('No verified current-season schedule is available for deployment');
