CREATE TABLE IF NOT EXISTS speed_runs (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS speed_runs_updated ON speed_runs(updated_at);
