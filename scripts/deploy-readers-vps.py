"""Replace only the two readers, preserving every other currently live app."""
import base64
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

repo=Path(__file__).resolve().parents[1]
helper=next(p for p in (repo.parent/'vps-playground',repo.parent.parent/'Archives'/'vps-playground') if (p/'remote_paramiko.py').is_file())
sys.path.insert(0,str(helper))
from remote_paramiko import remote
bundle=repo/'.wrangler/reader-release'
assert all((bundle/site/'worker.mjs').is_file() for site in ['ln','novel'])
expected_hashes=[]
for ref in ['3849921','28c58b4']:
 expected=subprocess.check_output(['git','-c','safe.directory='+str(repo).replace('\\','/'),'show',ref+':vps-content/runtime.mjs'],cwd=repo)
 expected_hashes.extend(hashlib.sha256(data).hexdigest() for data in (expected, expected.replace(b'\n',b'\r\n')))
expected_hashes.append(hashlib.sha256((repo/'vps-content/runtime.mjs').read_bytes().replace(b'\r\n',b'\n')).hexdigest())
name=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-readers')
install=r'''
import json,os,subprocess,time,urllib.request
from pathlib import Path
base=Path('/opt/yukino-content');release=Path(__file__).resolve().parent
status=base/'reader-install-status.json';current=base/'current';previous=str(current.resolve())
def record(phase,**extra):status.write_text(json.dumps({'phase':phase,'release':str(release),'previous':previous,**extra}))
def activate(path):
 link=base/'reader-current.next'
 if link.is_symlink():link.unlink()
 link.symlink_to(path,target_is_directory=True);link.replace(current)
try:
 record('validating')
 for file in ['vps-content/runtime.mjs','ln/worker.mjs','novel/worker.mjs']:
  subprocess.run([str(base/'node/bin/node'),'--check',str(release/file)],check=True,timeout=20)
 record('starting');activate(release);subprocess.run(['systemctl','restart','yukino-content'],check=True,timeout=30)
 for attempt in range(25):
  try:
   for host in ['ln','novel']:
    req=urllib.request.Request('http://127.0.0.1:18780/__health',headers={'Host':host+'.yukino.bond'})
    with urllib.request.urlopen(req,timeout=3) as r:assert json.load(r)['site']==host
   break
  except Exception:time.sleep(1)
 else:raise RuntimeError('Both readers did not become healthy')
 record('ready')
except Exception as error:
 activate(previous);subprocess.run(['systemctl','restart','yukino-content'],timeout=30)
 record('rolled-back',error=str(error));raise
'''
archive=io.BytesIO()
with tarfile.open(fileobj=archive,mode='w:gz') as target:
 for site in ['ln','novel']:target.add(bundle/site,arcname=site)
 for file in ['runtime.mjs','reader-preview.mjs','backup.py']:target.add(repo/'vps-content'/file,arcname='vps-content/'+file)
 info=tarfile.TarInfo('install_readers.py');body=install.encode();info.size=len(body);target.addfile(info,io.BytesIO(body))
body=archive.getvalue()
code=f'''
from pathlib import Path
import base64,hashlib,io,json,shutil,subprocess,tarfile
base=Path('/opt/yukino-content');old=(base/'current').resolve();release=base/'releases'/{name!r}
assert old.parent==base/'releases' and not release.exists()
assert hashlib.sha256((old/'vps-content/runtime.mjs').read_bytes()).hexdigest()in {expected_hashes!r},'Live runtime changed; recheck before deploying'
payload=base64.b64decode({base64.b64encode(body).decode()!r})
assert hashlib.sha256(payload).hexdigest()=={hashlib.sha256(body).hexdigest()!r}
shutil.copytree(old,release,symlinks=True)
for name in ['ln','novel']:
 target=release/name
 assert target.parent==release and release.parent==base/'releases'
 if target.exists():shutil.rmtree(target)
with tarfile.open(fileobj=io.BytesIO(payload),mode='r:gz') as archive:archive.extractall(release,filter='data')
version=release/'version.json'
if version.exists():
 info=json.loads(version.read_text());info['sites']=list(dict.fromkeys(info.get('sites',[])+['ln','novel']));info['readersRelease']={name!r};version.write_text(json.dumps(info,indent=2))
with open(base/'reader-install.log','ab') as log:
 job=subprocess.Popen(['python3',str(release/'install_readers.py')],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
print(json.dumps({{'uploaded':True,'release':str(release),'pid':job.pid,'bytes':len(payload)}}))
'''
print(remote(code,timeout=100))
