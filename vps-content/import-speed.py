"""Merge a private D1 export while preserving live speed task identities."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import sqlite3
from contextlib import closing

COLUMNS = ['id', 'token_hash', 'bytes', 'duration_ms', 'created_at', 'updated_at', 'finished']
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.I)
SCHEMA = '''CREATE TABLE IF NOT EXISTS speed_runs (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,
 bytes INTEGER NOT NULL DEFAULT 0,duration_ms INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,finished INTEGER NOT NULL DEFAULT 0)'''


def load_export(source):
    if source.stat().st_size > 200 * 1024 * 1024:
        raise ValueError('Export exceeds migration limit')
    staging = sqlite3.connect(':memory:')
    staging.enable_load_extension(False)

    def authorize(action, first, second, database, trigger):
        if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH, sqlite3.SQLITE_FUNCTION,
                      sqlite3.SQLITE_CREATE_TRIGGER, sqlite3.SQLITE_CREATE_VIEW):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_PRAGMA and first.lower() not in ('defer_foreign_keys', 'foreign_keys'):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_CREATE_TABLE and first != 'speed_runs':
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    try:
        staging.set_authorizer(authorize)
        staging.executescript(source.read_text(encoding='utf-8'))
        staging.set_authorizer(None)
        if staging.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise ValueError('Invalid staging database')
        tables = staging.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        if tables != [('speed_runs',)] or [row[1] for row in staging.execute('PRAGMA table_info(speed_runs)')] != COLUMNS:
            raise ValueError('Export contains unexpected tables or columns')
        rows = staging.execute('SELECT ' + ','.join(COLUMNS) + ' FROM speed_runs').fetchall()
        if not rows:
            raise ValueError('Historical export is empty; public cutover is not safe')
        for row in rows:
            if not isinstance(row[0], str) or not UUID.fullmatch(row[0]) or not isinstance(row[1], str) or not re.fullmatch(r'[0-9a-f]{64}', row[1]):
                raise ValueError('Invalid task identity in export')
            if any(not isinstance(value, int) or value < 0 or value > 2**53 - 1 for value in row[2:]) or row[6] not in (0, 1):
                raise ValueError('Invalid task counters in export')
        return rows
    finally:
        staging.close()


def merge(source, target):
    rows = load_export(source)
    # Keep the service's file ownership, private cache, and active tasks intact.
    if not target.is_file():
        raise ValueError('Expected existing service database')
    with closing(sqlite3.connect(target, timeout=30)) as db:
        db.execute('BEGIN IMMEDIATE')
        try:
            db.execute(SCHEMA)
            before = db.execute('SELECT count(*) FROM speed_runs').fetchone()[0]
            for row in rows:
                existing = db.execute('SELECT token_hash FROM speed_runs WHERE id=?', (row[0],)).fetchone()
                if existing and existing[0] != row[1]:
                    raise ValueError('Task identity conflict; target transaction rolled back')
                db.execute('''INSERT INTO speed_runs VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                    bytes=MAX(speed_runs.bytes,excluded.bytes),duration_ms=MAX(speed_runs.duration_ms,excluded.duration_ms),
                    created_at=MIN(speed_runs.created_at,excluded.created_at),updated_at=MAX(speed_runs.updated_at,excluded.updated_at),
                    finished=MAX(speed_runs.finished,excluded.finished)''', row)
            aggregate = db.execute('SELECT COALESCE(SUM(bytes),0),COUNT(CASE WHEN bytes>0 THEN 1 END),COUNT(*) FROM speed_runs').fetchone()
            if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='speed_totals'").fetchone():
                if db.execute('SELECT bytes,sessions FROM speed_totals WHERE id=1').fetchone() != aggregate[:2]:
                    raise ValueError('Aggregate triggers missing or inconsistent; transaction rolled back')
            db.commit()
        except BaseException:
            db.rollback()
            raise
        if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise ValueError('Target integrity check failed')
    return {'exportSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'importedRows': len(rows),
            'previousRows': before, 'storedRows': aggregate[2], 'bytes': aggregate[0], 'sessions': aggregate[1], 'integrity': 'ok'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--target', type=Path, default=Path('/var/lib/yukino-content/speed/storage.sqlite'))
    args = parser.parse_args()
    print(json.dumps(merge(args.source, args.target)))
