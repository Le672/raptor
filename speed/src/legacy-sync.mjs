import { Reporter, readRuns, saveRun } from './storage.mjs';
import { readTab } from './tab-state.mjs';
export const SPEED_API_BASES = ['https://speed.yukino.bond/api/speed', 'https://yukino-speed.pages.dev/api/speed'];
export async function syncLegacySpeed(storage = globalThis.localStorage, tabStorage = globalThis.sessionStorage, bases = SPEED_API_BASES) {
  const records = readRuns(storage), current = readTab(tabStorage, records);
  if (current) { saveRun(current, storage); const index = records.findIndex(run => run.id === current.id); if (index < 0) records.push(current); else records[index] = current; }
  let failure;
  const reporter = new Reporter(bases, result => { if (!result.ok) failure = result.error; }, storage);
  for (const record of records) reporter.enqueue(record);
  await reporter.flush();
  if (failure) throw new Error(failure);
  return { sessions: records.filter(record => record.bytes > 0).length, bytes: records.reduce((sum, record) => sum + record.bytes, 0) };
}
