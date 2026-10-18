from pathlib import Path
from unittest.mock import patch
import json
import sqlite3
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from safe_fetch import public_url, snapshot

KEY = 'test-only-key-with-more-than-32-characters'

class LabTests(unittest.TestCase):
    def setUp(self):
        temp_root = Path(__file__).resolve().parents[1] / '.local' / 'test-tmp'
        temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_context = patch('tempfile.tempdir', str(temp_root))
        self.temp_context.start()
        self.tmp = tempfile.TemporaryDirectory(dir=temp_root)
        assert Path(self.tmp.name).resolve().is_relative_to(temp_root.resolve())
        self.config = {'TESTING':True, 'OWNER_KEY':KEY, 'DATABASE':str(Path(self.tmp.name)/'apps.sqlite3')}
        self.app = create_app(self.config)
        self.client = self.app.test_client()
        self.auth = {'Authorization':'Bearer '+KEY}
    def tearDown(self):
        self.tmp.cleanup()
        self.temp_context.stop()
    def post(self,path,data):
        return self.client.post('/lab/api/'+path,json=data,headers=self.auth)
    def test_private_records_and_export_require_authentication(self):
        for name in ['overview','monitors','hooks','links','export']:
            self.assertEqual(self.client.get('/lab/api/'+name).status_code,401)
    def test_session_cookie_csrf_and_cross_origin_login(self):
        self.assertEqual(self.client.post('/lab/api/session',json={'key':KEY},headers={'Origin':'https://evil.example'}).status_code,403)
        login=self.client.post('/lab/api/session',json={'key':KEY})
        self.assertEqual(login.status_code,200)
        cookie=login.headers['Set-Cookie']
        for flag in ['Secure','HttpOnly','SameSite=Strict','Path=/lab']:
            self.assertIn(flag,cookie)
        self.assertEqual(self.client.post('/lab/api/hooks',json={'name':'拒绝跨站请求'}).status_code,403)
        response=self.client.post('/lab/api/hooks',json={'name':'真实信箱'},headers={'X-CSRF-Token':login.json['csrf']})
        self.assertEqual(response.status_code,201)
    def test_webhook_receives_and_redacts_credentials(self):
        hook=self.post('hooks',{'name':'测试回调'})
        items=self.client.get('/lab/api/hooks',headers=self.auth).json['items']
        path=items[0]['url'].replace('https://tools.yukino.bond','')
        response=self.client.post(path+'?token=hidden&event=deploy',data='{"message":"你好"}',content_type='application/json',headers={'Authorization':'Bearer do-not-store','Cookie':'session=private'})
        self.assertEqual(response.status_code,202)
        event=self.client.get('/lab/api/hooks/'+str(hook.json['id'])+'/events',headers=self.auth).json['items'][0]
        self.assertIn('你好',event['body'])
        self.assertEqual(event['headers']['Authorization'],'[已遮盖]')
        self.assertNotIn('hidden',event['query'])
        self.assertNotIn('do-not-store',json.dumps(event))
    def test_webhook_retention_disable_and_body_limits(self):
        hook_id=self.post('hooks',{'name':'控制信箱'}).json['id']
        path=self.client.get('/lab/api/hooks',headers=self.auth).json['items'][0]['url'].replace('https://tools.yukino.bond','')
        self.assertEqual(self.client.post(path,data=b'x'*32769).status_code,413)
        self.assertEqual(self.client.post(path,data=b'x'*17000).status_code,202)
        events=self.client.get(f'/lab/api/hooks/{hook_id}/events',headers=self.auth).json['items']
        self.assertTrue(events[0]['truncated'])
        self.assertEqual(len(events[0]['body']),16384)
        self.client.patch(f'/lab/api/hooks/{hook_id}',headers=self.auth,json={'enabled':False})
        self.assertEqual(self.client.post(path,data='ignored').status_code,404)
        with self.app.db() as connection:
            connection.execute('UPDATE events SET created_at=?',(time.time()-8*86400,))
        self.app.maintenance()
        self.assertEqual(self.client.get(f'/lab/api/hooks/{hook_id}/events',headers=self.auth).json['items'],[])
    def test_webhook_header_storage_is_bounded(self):
        item_id=self.post('hooks',{'name':'长请求头'}).json['id']
        path=self.client.get('/lab/api/hooks',headers=self.auth).json['items'][0]['url'].replace('https://tools.yukino.bond','')
        response=self.client.post(path+'?key=do-not-store',data='bounded',headers={f'X-Long-{i}':'a'*1000 for i in range(20)})
        self.assertEqual(response.status_code,202)
        item=self.client.get(f'/lab/api/hooks/{item_id}/events',headers=self.auth).json['items'][0]
        self.assertLessEqual(len(json.dumps(item['headers']).encode()),8192)
        self.assertNotIn('do-not-store',item['query'])
        self.assertIn('X-Yukino-Note',item['headers'])
    def test_shortlink_redirect_count_disable_expiry_and_qr(self):
        response=self.post('links',{'name':'我的小站','target':'https://www.yukino.bond/','slug':'my-site'})
        link_id=response.json['id']
        self.assertEqual(response.status_code,201)
        result=self.client.get('/lab/s/my-site')
        self.assertEqual(result.status_code,302)
        self.assertEqual(result.headers['Location'],'https://www.yukino.bond/')
        self.client.head('/lab/s/my-site')
        item=self.client.get('/lab/api/links',headers=self.auth).json['items'][0]
        self.assertEqual(item['clicks'],1)
        qr=self.client.get(f'/lab/api/links/{link_id}/qr.svg',headers=self.auth)
        self.assertIn(b'<svg',qr.data)
        self.client.patch(f'/lab/api/links/{link_id}',headers=self.auth,json={'enabled':False})
        self.assertEqual(self.client.get('/lab/s/my-site').status_code,410)
        with self.app.db() as connection:
            connection.execute('UPDATE links SET enabled=1,expires_at=?',(time.time()-1,))
        self.assertEqual(self.client.get('/lab/s/my-site').status_code,410)
        self.assertNotIn('Location',self.client.get('/lab/s/my-site').headers)
    def test_redirects_reject_unsafe_urls(self):
        for value in ['javascript:alert(1)','https://user:password@example.com/','http://127.0.0.1/','http://169.254.169.254/','http://localhost/','https://example.com:8443/']:
            self.assertEqual(self.post('links',{'target':value}).status_code,400,value)
    def test_records_survive_application_restart(self):
        self.post('links',{'name':'持久化','target':'https://www.yukino.bond/','slug':'persist'})
        second=create_app(self.config).test_client()
        self.assertEqual(second.get('/lab/api/links',headers=self.auth).json['items'][0]['slug'],'persist')
    def test_radar_real_change_and_failure_preserve_snapshot(self):
        with patch('safe_fetch.socket.getaddrinfo',return_value=[(None,None,None,None,('1.1.1.1',443))]):
            response=self.post('monitors',{'name':'页面','url':'https://example.com/','interval':900})
        self.assertEqual(response.status_code,201)
        item_id=response.json['id']
        self.app.config['SNAPSHOT_FETCHER']=lambda *args:{'text':'版本一\n功能 A','status':200,'latency_ms':12,'truncated':False}
        self.assertTrue(self.app.check_monitor(item_id)['initial'])
        self.assertFalse(self.app.check_monitor(item_id)['changed'])
        self.app.config['SNAPSHOT_FETCHER']=lambda *args:{'text':'版本二\n功能 B','status':200,'latency_ms':14,'truncated':False}
        self.assertTrue(self.app.check_monitor(item_id)['changed'])
        history=self.client.get(f'/lab/api/monitors/{item_id}/history',headers=self.auth).json
        self.assertEqual(len(history['items']),2)
        self.assertIn('+版本二',history['diff'])
        def unavailable(*args): raise ValueError('站点返回 HTTP 403，本次未更新快照')
        self.app.config['SNAPSHOT_FETCHER']=unavailable
        self.assertFalse(self.app.check_monitor(item_id)['ok'])
        self.assertEqual(len(self.client.get(f'/lab/api/monitors/{item_id}/history',headers=self.auth).json['items']),2)
    def test_radar_blocks_private_or_mixed_dns_answers(self):
        for addresses in [('127.0.0.1',),('1.1.1.1','10.0.0.1'),('169.254.169.254',)]:
            with patch('safe_fetch.socket.getaddrinfo',return_value=[(None,None,None,None,(ip,443)) for ip in addresses]):
                with self.assertRaises(ValueError): public_url('https://example.com/',resolve=True)
    def test_redirect_to_private_network_is_revalidated(self):
        def curl(command,**kwargs):
            header=Path(command[command.index('-D')+1]); header.write_text('HTTP/2 302\nLocation: http://127.0.0.1/secret\n')
            class Result: returncode=0; stdout=b'302'
            return Result()
        with patch('safe_fetch.socket.getaddrinfo',return_value=[(None,None,None,None,('1.1.1.1',443))]),patch('safe_fetch.subprocess.run',side_effect=curl) as process:
            with self.assertRaises(ValueError): snapshot('https://example.com/')
            self.assertEqual(process.call_count,1)
    def test_user_payload_cannot_become_markup_in_static_shell(self):
        response=self.client.get('/lab/hooks/')
        self.assertEqual(response.status_code,200)
        self.assertIn("script-src 'self'",response.headers['Content-Security-Policy'])
        self.assertIn("frame-ancestors 'none'",response.headers['Content-Security-Policy'])
        self.assertNotIn(b'unsafe-inline',response.headers['Content-Security-Policy'].encode())

if __name__=='__main__': unittest.main()
