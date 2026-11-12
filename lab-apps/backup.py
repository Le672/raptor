"""Online SQLite backup. Only this application's 14-day backup files expire."""
from datetime import datetime, timezone
from pathlib import Path
import os
import re
import sqlite3
import time

os.umask(0o077)
source = Path('/var/lib/yukino-lab-apps/apps.sqlite3')
folder = Path('/var/backups/yukino-lab/apps')
folder.mkdir(parents=True, exist_ok=True, mode=0o700)
if folder.resolve() != folder:
    raise RuntimeError('Unexpected backup directory')
target = folder / ('apps-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.sqlite3')
with sqlite3.connect('file:' + str(source) + '?mode=ro', uri=True) as original, sqlite3.connect(target) as backup:
    original.backup(backup)
    if backup.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
        raise RuntimeError('Backup integrity check failed')
for old in folder.iterdir():
    if re.fullmatch(r'apps-\d{8}T\d{6}Z\.sqlite3', old.name) and old.is_file() and not old.is_symlink() and old.stat().st_mtime < time.time()-14*86400:
        old.unlink()
print('Yukino Lab apps backup verified: ' + target.name)
