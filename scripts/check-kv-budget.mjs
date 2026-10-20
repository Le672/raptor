import { readFile } from 'node:fs/promises';
import { KV_WRITES_PER_REFRESH as cinemaWrites } from '../cinema/server/service.mjs';
import { KV_WRITES_PER_REFRESH as comicWrites } from '../comic/server/service.mjs';
import { KV_WRITES_PER_REFRESH as novelWrites } from '../novel/server/cache.mjs';

// The free allowance belongs to the account, not to each namespace/Worker.
// Keep at least half available for mail sign-ins, settings and attachments.
const MAX_CONTENT_WRITES_PER_DAY = 500;
const sites = [
  ['cinema', cinemaWrites],
  ['comic', comicWrites],
  ['novel', novelWrites],
];
const budget = [];
for (const [site, writes] of sites) {
  const config = JSON.parse(await readFile(new URL(`../${site}/wrangler.jsonc`, import.meta.url), 'utf8'));
  const crons = config.triggers?.crons;
  if (!Array.isArray(crons) || crons.length !== 1 || !/^(?:[0-5]?\d) \* \* \* \*$/.test(crons[0])) {
    throw new Error(`${site}: catalog persistence must run once per hour; review the account KV budget before changing its schedule`);
  }
  if (!Number.isSafeInteger(writes) || writes < 1) throw new Error(`${site}: invalid tested writes-per-refresh bound`);
  budget.push({ site, cron: crons[0], writesPerRefresh: writes, scheduledWritesPerDay: writes * 24 });
}
const total = budget.reduce((sum, item) => sum + item.scheduledWritesPerDay, 0);
if (total > MAX_CONTENT_WRITES_PER_DAY) throw new Error(`Content sites need ${total} KV writes/day, exceeding the ${MAX_CONTENT_WRITES_PER_DAY}/day shared budget`);
console.table(budget);
console.log(`Scheduled content KV writes: at most ${total}/day under the configured schedules; allowance reserved for other services: at least ${1000 - total}/day.`);
console.log('Visitor APIs must remain zero-KV-write paths, covered by each site\'s quota tests. Duplicate cron deliveries and administrative writes are outside this schedule estimate.');
