"""Deploy only the status app and scheduler, preserving the other live apps."""
import base64
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
from datetime import datetime, timezone

repo = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(repo.parent / 'vps-playground'))
from remote_paramiko import remote

bundle = repo / '.wrangler/status-release'
assert (bundle / 'status/worker.mjs').is_file()
archive = io.BytesIO()
with tarfile.open(fileobj=archive, mode='w:gz') as target:
    if '--worker-only' in sys.argv:
        target.add(bundle / 'status/worker.mjs', arcname='status/worker.mjs')
    else:
        target.add(bundle / 'status', arcname='status')
        target.add(repo / 'vps-content/runtime.mjs', arcname='vps-content/runtime.mjs')
body = archive.getvalue()
name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-status')
code = f'''
import base64,hashlib,io,json,shutil,subprocess,tarfile,time,urllib.request
from pathlib import Path
base=Path('/opt/yukino-content')
previous=(base/'current').resolve(strict=True)
assert previous.is_relative_to(base/'releases')
release=base/'releases'/{name!r}
shutil.copytree(previous,release,symlinks=True)
body=base64.b64decode({base64.b64encode(body).decode()!r})
assert hashlib.sha256(body).hexdigest()=={hashlib.sha256(body).hexdigest()!r}
with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz') as archive:
 archive.extractall(release,filter='data')
link=base/'current.status-next'
link.symlink_to(release,target_is_directory=True)
link.replace(base/'current')
try:
 subprocess.run(['systemctl','restart','yukino-content'],check=True,timeout=30)
 for attempt in range(20):
  try:
   request=urllib.request.Request('http://127.0.0.1:18780/api/history',headers={{'Host':'status.yukino.bond'}})
   with urllib.request.urlopen(request,timeout=5) as response: history=json.load(response)
   assert len(history['hours'])==72
   break
  except Exception:
   time.sleep(1)
 else: raise RuntimeError('Status history health check failed')
 request=urllib.request.Request('http://127.0.0.1:18780/api/status',headers={{'Host':'status.yukino.bond'}})
 with urllib.request.urlopen(request,timeout=35) as response: report=json.load(response)
 urls={{service['url'] for service in report['services']}}
 assert 'https://ln.yukino.bond/api/books?source=bili&sort=updated' in urls
 assert 'https://novel.yukino.bond/api/books?source=zongheng&sort=updated' in urls
except Exception:
 rollback=base/'current.status-rollback'
 rollback.symlink_to(previous,target_is_directory=True)
 rollback.replace(base/'current')
 subprocess.run(['systemctl','restart','yukino-content'],check=True,timeout=30)
 raise
result={{'phase':'ready','release':str(release),'previous':str(previous),'historyHours':len(history['hours']),'services':len(urls)}}
(base/'status-release.json').write_text(json.dumps(result))
print(json.dumps(result))
'''
print(remote(code, timeout=120))
