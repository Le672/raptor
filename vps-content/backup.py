"""Online SQLite backups of the three content caches, including playback keys."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import sqlite3

os.umask(0o077)
target = Path('/var/backups/yukino-content') / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
target.mkdir(parents=True, exist_ok=False, mode=0o700)
saved = []
for site in ['cinema', 'comic', 'novel', 'speed']:
    source = Path('/var/lib/yukino-content') / site / 'storage.sqlite'
    with sqlite3.connect(f'file:{source}?mode=ro', uri=True) as incoming:
        with sqlite3.connect(target / f'{site}.sqlite') as outgoing:
            incoming.backup(outgoing)
            if outgoing.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise RuntimeError('Backup integrity check failed')
    saved.append({'site': site, 'sha256': hashlib.sha256((target / f'{site}.sqlite').read_bytes()).hexdigest()})
(target / 'manifest.json').write_text(json.dumps(saved, indent=2))
print(json.dumps({'backed_up': [item['site'] for item in saved], 'path': str(target)}))
