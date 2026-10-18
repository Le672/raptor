import type { PortalDatabase } from "./db";
import { inferHistoricalEquipment, parseHistoricalUnits } from "../../src/lib/rail-equipment-history";
import type { EquipmentObservation } from "../../src/lib/rail-equipment-history";
import type { TrainEquipment } from "../../src/lib/rail-equipment";
import type { OfficialTrainRoute } from "../../src/lib/rail-official";

const ready = new WeakMap<object, Promise<void>>();
const pruned = new WeakMap<object, string>();
async function ensureSchema(db: PortalDatabase) {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      await db.prepare(`CREATE TABLE IF NOT EXISTS rail_equipment_observations (
      train TEXT NOT NULL, day TEXT NOT NULL, route TEXT NOT NULL, model TEXT NOT NULL,
      checked_at INTEGER NOT NULL, PRIMARY KEY (train, day, route)
      )`).run();
      await db.prepare("CREATE INDEX IF NOT EXISTS rail_equipment_observations_day ON rail_equipment_observations(day)").run();
    })();
    ready.set(db, pending);
  }
  try { await pending; } catch (error) { ready.delete(db); throw error; }
}
const identity = (route: OfficialTrainRoute) => `${route.trainNo}/${route.from}/${route.to}`;
export async function recordOfficialEquipment(db: PortalDatabase | undefined, train: string, route: OfficialTrainRoute, item: TrainEquipment) {
  if (!db || !item.model || item.scope !== "dated" || item.source !== "12306") return;
  try {
    await ensureSchema(db);
    await db.prepare(`INSERT INTO rail_equipment_observations (train,day,route,model,checked_at) VALUES (?,?,?,?,?)
      ON CONFLICT(train,day,route) DO UPDATE SET model=excluded.model,checked_at=excluded.checked_at`)
      .bind(train, item.date, identity(route), item.model, item.checkedAt).run();
    // Bound retention without collecting any visitor or location information.
    const today = new Date().toISOString().slice(0, 10);
    if (pruned.get(db) !== today) {
      await db.prepare("DELETE FROM rail_equipment_observations WHERE day < ?")
        .bind(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)).run();
      pruned.set(db, today);
    }
  } catch { /* Optional history storage must not block today's official model. */ }
}
const historyCache = new Map<string, { until: number; rows: EquipmentObservation[] }>();
const pending = new Map<string, Promise<EquipmentObservation[]>>();
async function historicalUnits(train: string) {
  // rail.re covers EMU/intercity service identities, not locomotive-hauled K/T/Z.
  if (!/^[GDC]\d{1,4}$/.test(train)) return [];
  const cached = historyCache.get(train);
  if (cached && cached.until > Date.now()) return cached.rows;
  if (pending.has(train)) return pending.get(train)!;
  const request = (async () => {
    let rows: EquipmentObservation[] = [];
    try {
      const response = await fetch(`https://api.rail.re/train/${encodeURIComponent(train)}`, { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
      if (response.ok) rows = parseHistoricalUnits(await response.json(), train);
    } catch { /* A missing history remains unknown. */ }
    if (historyCache.size >= 500) historyCache.delete(historyCache.keys().next().value!);
    historyCache.set(train, { rows, until: Date.now() + (rows.length ? 6 * 3600000 : 5 * 60000) });
    return rows;
  })();
  pending.set(train, request);
  try { return await request; } finally { pending.delete(train); }
}
export async function historicalEquipment(db: PortalDatabase | undefined, train: string, date: string, route?: OfficialTrainRoute) {
  if (db && route) {
    try {
      await ensureSchema(db);
      const rows = await db.prepare("SELECT train,day AS date,model,'12306' AS source FROM rail_equipment_observations WHERE train=? AND route=? AND day<? ORDER BY day DESC LIMIT 60")
        .bind(train, identity(route), date).all<EquipmentObservation>();
      const official = inferHistoricalEquipment(rows.results || [], train, date);
      if (official) return official;
    } catch { /* Continue with explicitly labelled historical unit records. */ }
  }
  return inferHistoricalEquipment(await historicalUnits(train), train, date);
}
