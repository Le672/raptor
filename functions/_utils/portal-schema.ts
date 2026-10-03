type Database = { prepare: (sql: string) => { run: () => Promise<unknown> } };
const ready = new WeakMap<object, Promise<void>>();

// Additive, idempotent initialization through the bound D1 database. This also
// works when the Pages deployment token has no permission to administer D1.
export async function ensurePortalSchema(db: Database): Promise<void> {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      await db.prepare(`CREATE TABLE IF NOT EXISTS mail_identities (
        mail_user_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        portal_role TEXT NOT NULL DEFAULT 'user' CHECK (portal_role IN ('admin', 'user')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`).run();
      await db.prepare(`CREATE TABLE IF NOT EXISTS site_content (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      )`).run();
    })();
    ready.set(db, pending);
  }
  try { await pending; } catch (error) { ready.delete(db); throw error; }
}
