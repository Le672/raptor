"""Add public PWA assets to the existing gateway; preserve containers and data."""
from pathlib import Path
import base64
import json
import sys

repository = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repository.parent / 'vps-playground'))
from remote_paramiko import remote

files, clients = {}, {}
for app in ['draw', 'tools', 'drop']:
    build = repository / '.wrangler/pwa-gateway' / app
    metadata = json.loads((build / 'yukino-app-build.json').read_text(encoding='utf-8'))
    clients[app] = metadata['client']
    for path in build.rglob('*'):
        if path.is_file() and path.relative_to(build).parts[0].startswith('yukino-app-'):
            name = path.relative_to(build).as_posix()
            files[name] = base64.b64encode(path.read_bytes()).decode()
payload = base64.b64encode(json.dumps({'files': files, 'clients': clients}).encode()).decode()
code = r'''
from pathlib import Path
import base64,datetime,json,re,subprocess
base=Path('/opt/yukino-lab')
if json.loads((base/'project.json').read_text()).get('project')!='yukino-lab':raise RuntimeError('Unexpected gateway')
payload=json.loads(base64.b64decode(PAYLOAD))
portal=base/'portal'
config=base/'nginx.conf'
original=config.read_text()
brand=portal/'lab-brand.js'
original_brand=brand.read_text()
backup=base/'pwa-backups'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup.mkdir(parents=True,exist_ok=False)
(backup/'nginx.conf').write_text(original)
(backup/'lab-brand.js').write_text(original_brand)
for name,body in payload['files'].items():
 target=portal/name
 if not target.resolve().is_relative_to(portal.resolve()) or not name.startswith('yukino-app-'):raise RuntimeError('Unexpected asset path')
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_bytes(base64.b64decode(body))
fragment=r"""
        location ~ ^/yukino-app-assets/ { root /srv/portal; try_files $uri =404; add_header Cache-Control "public, max-age=31536000, immutable" always; }
        location ~ ^/yukino-app-sw-[a-z0-9-]+\.js$ { root /srv/portal; try_files $uri =404; add_header Cache-Control "no-store, no-cache, must-revalidate" always; add_header CDN-Cache-Control "no-store" always; add_header Cloudflare-CDN-Cache-Control "no-store" always; add_header Service-Worker-Allowed "/" always; }
        location ~ ^/yukino-app-manifest-[a-z0-9-]+\.webmanifest$ { root /srv/portal; types { application/manifest+json webmanifest; } try_files $uri =404; add_header Cache-Control "no-cache" always; }
        location ~ ^/yukino-app-shell-[a-z0-9-]+\.html$ { root /srv/portal; try_files $uri =404; add_header Cache-Control "no-store" always; }
"""
(portal/'yukino-app-locations.conf').write_text(fragment)
updated=original
for app in ['draw','tools','drop']:
 needle='server_name '+app+'.yukino.bond;'
 if updated.count(needle)!=1:raise RuntimeError('Unexpected host count')
 # The legacy brand script is loaded by old cached shells too. Its bounded
 # loader upgrades installed clients without deleting canvases or user storage.
 if needle+'\n        include /srv/portal/yukino-app-locations.conf;' not in updated:
  updated=updated.replace(needle,needle+'\n        include /srv/portal/yukino-app-locations.conf;',1)
loader="""\n/*YUKINO_PWA_BOOTSTRAP*/\n(()=>{const paths=PATHS;const id=location.hostname.split('.')[0];if(window.__YUKINO_APP__||!paths[id])return;const node=document.createElement('script');node.src=paths[id];node.dataset.yukinoApp='';document.head.append(node);})();\n""".replace('PATHS',json.dumps(payload['clients']))
config.write_text(updated)
brand.write_text(original_brand.split('/*YUKINO_PWA_BOOTSTRAP*/')[0]+loader)
compose=['docker','compose','-p','yukino-lab','-f',str(base/'compose.pinned.json'),'exec','-T','edge','nginx']
try:
 subprocess.run(compose+['-t'],check=True,capture_output=True,text=True)
 subprocess.run(compose+['-s','reload'],check=True,capture_output=True,text=True)
except Exception:
 config.write_text(original);brand.write_text(original_brand)
 subprocess.run(compose+['-t'],check=True,capture_output=True,text=True)
 raise
print(json.dumps({'updated':['draw.yukino.bond','tools.yukino.bond','drop.yukino.bond'],'assets':len(payload['files']),'gateway':'configuration verified and reloaded','backup':str(backup),'user_data':'untouched'}))
'''.replace('PAYLOAD', repr(payload))
print(remote(code, timeout=90))
