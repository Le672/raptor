CREATE TABLE IF NOT EXISTS nations_saves (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL,
  name TEXT NOT NULL, turn INTEGER NOT NULL, era INTEGER NOT NULL,
  schema_version INTEGER NOT NULL, revision INTEGER NOT NULL,
  state_hash TEXT NOT NULL, size_bytes INTEGER NOT NULL, r2_key TEXT NOT NULL,
  device_id TEXT NOT NULL, write_token TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS nations_saves_user ON nations_saves(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS nations_save_versions (
  save_id TEXT NOT NULL, user_id INTEGER NOT NULL, revision INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE, state_hash TEXT NOT NULL, size_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL, PRIMARY KEY(save_id,revision)
);
CREATE INDEX IF NOT EXISTS nations_versions_user ON nations_save_versions(user_id);
CREATE INDEX IF NOT EXISTS nations_versions_payload ON nations_save_versions(user_id,state_hash);
CREATE TABLE IF NOT EXISTS nations_save_chunks (
  user_id INTEGER NOT NULL, state_hash TEXT NOT NULL, chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL CHECK(length(data)<=262144),
  PRIMARY KEY(user_id,state_hash,chunk_index)
);
CREATE TABLE IF NOT EXISTS nations_save_budget (user_id INTEGER PRIMARY KEY, minute INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS nations_storage_migrations (name TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS nations_legacy_gc (r2_key TEXT PRIMARY KEY, queued_at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS nations_save_count BEFORE INSERT ON nations_saves
WHEN (SELECT COUNT(*) FROM nations_saves WHERE user_id=NEW.user_id AND deleted_at IS NULL)>=20
AND NOT EXISTS(SELECT 1 FROM nations_saves WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'NATIONS_SAVE_COUNT'); END;
CREATE TRIGGER IF NOT EXISTS nations_save_bytes BEFORE INSERT ON nations_save_versions
WHEN COALESCE((SELECT SUM(size_bytes) FROM nations_save_versions WHERE user_id=NEW.user_id),0)+NEW.size_bytes>52428800
BEGIN SELECT RAISE(ABORT,'NATIONS_SAVE_BYTES'); END;
