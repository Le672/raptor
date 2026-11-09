"""Publish only frontend files and the shared theme; preserve server code/data."""
from pathlib import Path
from datetime import datetime, timezone
import base64
import hashlib
import io
import json
import sys
import tarfile

repo = Path(__file__).resolve().parents[1]
helper = next(p for p in (repo.parent / 'vps-playground', repo.parent.parent / 'Archives/vps-playground') if (p / 'remote_paramiko.py').is_file())
sys.path.insert(0, str(helper))
from remote_paramiko import remote

sources = {'ln': 'ln/dist', 'novel': 'fiction/dist', 'cinema': 'cinema/dist', 'comic': 'comic/dist', 'speed': 'speed/dist', 'status': 'dist'}
archive = io.BytesIO()
with tarfile.open(fileobj=archive, mode='w:gz') as target:
    for site, directory in sources.items():
        source = repo / directory
        html = (source / 'index.html').read_text(encoding='utf-8')
        assert 'data-yukino-theme' in html
        for path in source.rglob('*'):
            if not path.is_file():
                continue
            relative = path.relative_to(source)
            if path.suffix == '.map' or relative.parts[0] in ['rail-network', 'f1', 'f1-player', 'age-of-nations', 'fog-harbor-files']:
                continue
            target.add(path, arcname=f'{site}/dist/{relative.as_posix()}')
body = archive.getvalue()
gateway = repo / '.wrangler/theme-gateway'
metadata = json.loads((gateway / 'theme.json').read_text(encoding='utf-8'))
files = {p.relative_to(gateway).as_posix(): base64.b64encode(p.read_bytes()).decode() for p in (gateway / 'yukino-app-assets').iterdir() if p.is_file()}
if '--prepare-only' in sys.argv:
    target = repo / '.wrangler/theme-release'
    target.mkdir(parents=True, exist_ok=True)
    (target / 'frontends.tar.gz').write_bytes(body)
    result = {'phase': 'prepared', 'sites': list(sources), 'gatewaySites': ['draw', 'tools', 'drop'], 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
    (target / 'manifest.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
    raise SystemExit(0)
name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-appearance')
payload = base64.b64encode(json.dumps({'files': files, 'client': metadata['client']}).encode()).decode()
code = r'''
from pathlib import Path
import base64,hashlib,io,json,re,shutil,subprocess,tarfile,time,urllib.request
base=Path('/opt/yukino-content');previous=(base/'current').resolve(strict=True)
assert previous.parent==base/'releases'
release=base/'releases'/NAME
assert not release.exists()
body=base64.b64decode(BODY)
assert hashlib.sha256(body).hexdigest()==DIGEST
shutil.copytree(previous,release,symlinks=True)
with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz') as archive:archive.extractall(release,filter='data')
gateway=Path('/opt/yukino-lab');assert json.loads((gateway/'project.json').read_text())['project']=='yukino-lab'
portal=gateway/'portal';config=gateway/'nginx.conf';brand=portal/'lab-brand.js'
old_config=config.read_text();old_brand=brand.read_text()
backup=gateway/'pwa-backups'/NAME;backup.mkdir(parents=True,exist_ok=False)
(backup/'nginx.conf').write_text(old_config);(backup/'lab-brand.js').write_text(old_brand)
data=json.loads(base64.b64decode(PAYLOAD))
for name,content in data['files'].items():
 path=portal/name;assert path.resolve().is_relative_to(portal.resolve()) and name.startswith('yukino-app-assets/')
 path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(base64.b64decode(content))
loader="\n/*YUKINO_THEME_BOOTSTRAP*/\n(()=>{if(window.YukinoTheme)return;const script=document.createElement('script');script.src="+json.dumps(data['client'])+";document.head.append(script);})();\n"
brand.write_text(old_brand.split('/*YUKINO_THEME_BOOTSTRAP*/')[0]+loader)
# Also cover private lab screens, expired links and cached app shells. The loader
# reads only a public theme asset, with no access to lab data or authentication.
asset_location='location ~ ^/yukino-app-assets/'
updated=old_config
for host in ['draw','tools','drop']:
 needle='server_name '+host+'.yukino.bond;';assert updated.count(needle)==1
 block=updated.split(needle,1)[1].split('server_name ',1)[0]
 if 'yukino-app-locations.conf' not in block and asset_location not in block:
  updated=updated.replace(needle,needle+'\n        location ~ ^/yukino-app-assets/ { root /srv/portal; try_files $uri =404; add_header Cache-Control "public, max-age=31536000, immutable" always; }',1)
needle='proxy_pass http://yukino_apps;'
assert updated.count(needle)==1
lab_filter='sub_filter \'</head>\' \'<script src="'+data['client']+'" defer></script></head>\';'
if 'YUKINO_LAB_THEME' not in updated:
 updated=updated.replace(needle,needle+'\n            # YUKINO_LAB_THEME\n            '+lab_filter+'\n            sub_filter_once on;',1)
else:
 updated=re.sub(r'(# YUKINO_LAB_THEME\n\s*)sub_filter[^\n]+',lambda match:match[1]+lab_filter,updated,count=1)
config.write_text(updated)
nginx=['docker','compose','-p','yukino-lab','-f',str(gateway/'compose.pinned.json'),'exec','-T','edge','nginx']
def activate(path):
 link=base/'appearance-current.next'
 if link.is_symlink():link.unlink()
 link.symlink_to(path,target_is_directory=True);link.replace(base/'current')
try:
 subprocess.run(nginx+['-t'],check=True,capture_output=True,text=True)
 activate(release);subprocess.run(['systemctl','restart','yukino-content'],check=True,timeout=30)
 subprocess.run(nginx+['-s','reload'],check=True,capture_output=True,text=True)
 for attempt in range(20):
  try:
   for site in ['ln','novel','cinema','comic','speed','status']:
    req=urllib.request.Request('http://127.0.0.1:18780/__health',headers={'Host':site+'.yukino.bond'})
    with urllib.request.urlopen(req,timeout=4) as response:assert json.load(response)['site']==site
   break
  except Exception:time.sleep(1)
 else:raise RuntimeError('Content service health checks failed')
except Exception:
 activate(previous);config.write_text(old_config);brand.write_text(old_brand)
 subprocess.run(['systemctl','restart','yukino-content'],timeout=30)
 subprocess.run(nginx+['-s','reload'],capture_output=True)
 raise
result={'phase':'ready','release':str(release),'previous':str(previous),'sites':['ln','novel','cinema','comic','speed','status','draw','tools','drop'],'gatewayBackup':str(backup),'userData':'untouched'}
(base/'appearance-release.json').write_text(json.dumps(result));print(json.dumps(result))
'''.replace('NAME', repr(name)).replace('BODY', repr(base64.b64encode(body).decode())).replace('DIGEST', repr(hashlib.sha256(body).hexdigest())).replace('PAYLOAD', repr(payload))
print(remote(code, timeout=120))
