type Database = { prepare: (sql: string) => { run: () => Promise<unknown> } };
const ready = new WeakMap<object, Promise<void>>();

// Additive initialization through the existing Pages D1 binding.
export async function ensureF1Schema(db: Database) {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      await db.prepare(`CREATE TABLE IF NOT EXISTS f1_leclerc_votes (
        poll_key TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        choice TEXT NOT NULL CHECK (choice IN ('yes', 'no')),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (poll_key, user_id)
      )`).run();
      await db.prepare(`CREATE TABLE IF NOT EXISTS f1_radio_text (
        recording_key TEXT PRIMARY KEY,
        transcript TEXT NOT NULL DEFAULT '',
        translation TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('working', 'ready', 'error')),
        lease_until INTEGER NOT NULL DEFAULT 0,
        error TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      )`).run();
      await db.prepare(`CREATE TABLE IF NOT EXISTS f1_radio_limits (
        bucket TEXT PRIMARY KEY,
        calls INTEGER NOT NULL
      )`).run();
    })();
    ready.set(db, pending);
  }
  try { await pending; } catch (error) { ready.delete(db); throw error; }
}
