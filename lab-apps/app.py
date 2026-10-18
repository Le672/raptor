"""Three small private services, with persistent storage and bounded resource use."""
from datetime import timedelta, datetime, timezone
from functools import wraps
from contextlib import contextmanager
from pathlib import Path
import collections
import difflib
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sqlite3
import subprocess
import threading
import time
from urllib.parse import parse_qsl, urlencode

from flask import Flask, abort, jsonify, request, session, send_file, render_template
import segno
from safe_fetch import public_url, snapshot

PREFIX = '/lab'
SENSITIVE = re.compile(r'authorization|cookie|password|passwd|secret|token|api[-_]?key|signature|credential|(?:^|[-_])key(?:$|[-_])', re.I)

SCHEMA = '''
CREATE TABLE IF NOT EXISTS monitors (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, keyword TEXT NOT NULL DEFAULT '',
 interval INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, next_at REAL NOT NULL DEFAULT 0,
 checked_at REAL, changed_at REAL, content_hash TEXT, status INTEGER, latency_ms INTEGER,
 last_error TEXT, truncated INTEGER DEFAULT 0, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS snapshots (
 id INTEGER PRIMARY KEY, monitor_id INTEGER REFERENCES monitors(id) ON DELETE CASCADE,
 text TEXT NOT NULL, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS hooks (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, token TEXT UNIQUE NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY, hook_id INTEGER REFERENCES hooks(id) ON DELETE CASCADE,
 method TEXT NOT NULL, query TEXT NOT NULL, headers TEXT NOT NULL, body TEXT NOT NULL,
 bytes INTEGER NOT NULL, truncated INTEGER NOT NULL, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS links (
 id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, target TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1, clicks INTEGER NOT NULL DEFAULT 0,
 expires_at REAL, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS visits (
 link_id INTEGER REFERENCES links(id) ON DELETE CASCADE, day TEXT NOT NULL,
 count INTEGER NOT NULL, PRIMARY KEY(link_id,day));
'''

def create_app(config=None):
    app = Flask(__name__, static_url_path=PREFIX + '/assets', static_folder='static')
    credentials = os.environ.get('CREDENTIALS_DIRECTORY')
    key_path = Path(credentials, 'owner-key') if credentials else None
    owner_key = os.environ.get('LAB_OWNER_KEY') or (key_path.read_text().strip() if key_path else '')
    state = Path(os.environ.get('STATE_DIRECTORY', str(Path(__file__).parent / '.local')))
    app.config.update(OWNER_KEY=owner_key, DATABASE=str(state / 'apps.sqlite3'),
        PUBLIC_ORIGIN='https://tools.yukino.bond', MAX_CONTENT_LENGTH=32768,
        SESSION_COOKIE_NAME='yukino_lab_owner', SESSION_COOKIE_PATH=PREFIX,
        SESSION_COOKIE_SECURE=True, SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Strict',
        PERMANENT_SESSION_LIFETIME=timedelta(days=1))
    if config:
        app.config.update(config)
    if len(app.config['OWNER_KEY']) < 24:
        raise RuntimeError('A dedicated random owner key of at least 24 characters is required')
    app.secret_key = hashlib.sha256(('yukino-lab-session:' + app.config['OWNER_KEY']).encode()).digest()
    app.json.ensure_ascii = False
    Path(app.config['DATABASE']).parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def db():
        connection = sqlite3.connect(app.config['DATABASE'], timeout=8)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys=ON')
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    with db() as connection:
        connection.execute('PRAGMA journal_mode=WAL')
        connection.executescript(SCHEMA)
    app.db = db
    app.check_locks = collections.defaultdict(threading.Lock)
    buckets = {}
    bucket_lock = threading.Lock()

    def rate_limit(key, limit, seconds):
        now = time.monotonic()
        with bucket_lock:
            if len(buckets) > 512:
                for name in list(buckets):
                    if not buckets[name] or now - buckets[name][-1] > 600:
                        buckets.pop(name, None)
                if len(buckets) > 512:
                    abort(429, '请求过多，请稍后再试')
            entries = buckets.setdefault(key, collections.deque())
            while entries and now - entries[0] > seconds:
                entries.popleft()
            if len(entries) >= limit:
                abort(429, '请求过多，请稍后再试')
            entries.append(now)

    def is_bearer():
        header = request.headers.get('Authorization', '')
        return header.startswith('Bearer ') and hmac.compare_digest(
            hashlib.sha256(header[7:].encode()).digest(), hashlib.sha256(app.config['OWNER_KEY'].encode()).digest())

    def private(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            bearer = is_bearer()
            if not bearer and not session.get('owner'):
                abort(401, '请先输入实验室管理口令')
            if request.method not in ('GET', 'HEAD', 'OPTIONS') and not bearer:
                if not hmac.compare_digest(request.headers.get('X-CSRF-Token', ''), session.get('csrf', 'missing')):
                    abort(403, '页面已失效，请刷新后重试')
            return view(*args, **kwargs)
        return wrapper

    def payload():
        if not request.is_json:
            abort(415, '请使用 JSON 请求')
        data = request.get_json()
        if not isinstance(data, dict):
            abort(400, '请求内容应为 JSON 对象')
        return data

    def name_of(data, default):
        value = str(data.get('name', default)).strip()
        if not value or len(value) > 80:
            abort(400, '名称应为 1–80 个字符')
        return value

    def capacity(connection, table, maximum):
        if connection.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0] >= maximum:
            abort(409, f'已达到 {maximum} 项上限，请先停用或整理现有项目')

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        return response

    @app.errorhandler(Exception)
    def error(error):
        from werkzeug.exceptions import HTTPException
        if isinstance(error, HTTPException):
            return jsonify(error=error.description), error.code
        if isinstance(error, (ValueError, sqlite3.IntegrityError)):
            return jsonify(error=str(error) if isinstance(error, ValueError) else '这个短名已被使用，请换一个'), 400
        app.logger.error('Lab request failed: %s', type(error).__name__)
        return jsonify(error='服务暂时不可用，请稍后重试'), 500

    @app.get(PREFIX + '/')
    @app.get(PREFIX + '/radar/')
    @app.get(PREFIX + '/hooks/')
    @app.get(PREFIX + '/links/')
    def shell():
        return render_template('index.html')

    @app.get(PREFIX + '/api/health')
    def health():
        with db() as connection:
            connection.execute('SELECT 1').fetchone()
        return jsonify(status='ok', version='1.0.0')

    @app.route(PREFIX + '/api/session', methods=['GET', 'POST', 'DELETE'])
    def login():
        if request.method == 'GET':
            authenticated = bool(session.get('owner')) or is_bearer()
            return jsonify(authenticated=authenticated, csrf=session.get('csrf') if authenticated else None)
        if request.method == 'DELETE':
            if not session.get('csrf') or not hmac.compare_digest(request.headers.get('X-CSRF-Token', ''), session['csrf']):
                abort(403)
            session.clear()
            return jsonify(ok=True)
        rate_limit('login:' + (request.remote_addr or 'edge'), 10, 60)
        origin = request.headers.get('Origin')
        if origin and origin != app.config['PUBLIC_ORIGIN']:
            abort(403, '请从实验室页面登录')
        candidate = str(payload().get('key', ''))
        if not hmac.compare_digest(hashlib.sha256(candidate.encode()).digest(),
                                   hashlib.sha256(app.config['OWNER_KEY'].encode()).digest()):
            abort(401, '管理口令不正确')
        session.clear()
        session.update(owner=True, csrf=secrets.token_urlsafe(24))
        session.permanent = True
        return jsonify(authenticated=True, csrf=session['csrf'])

    @app.get(PREFIX + '/api/overview')
    @private
    def overview():
        with db() as connection:
            counts = {table: connection.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]
                      for table in ('monitors', 'hooks', 'links', 'events')}
            counts['clicks'] = connection.execute('SELECT COALESCE(SUM(clicks),0) FROM links').fetchone()[0]
        return jsonify(**counts)

    def check_monitor(monitor_id):
        lock = app.check_locks[monitor_id]
        if not lock.acquire(blocking=False):
            raise ValueError('这个页面正在检查，请稍后刷新')
        try:
            with db() as connection:
                row = connection.execute('SELECT * FROM monitors WHERE id=?', (monitor_id,)).fetchone()
                if not row:
                    raise ValueError('监测项不存在')
                now = time.time()
                connection.execute('UPDATE monitors SET next_at=? WHERE id=?', (now + row['interval'], monitor_id))
            try:
                result = app.config.get('SNAPSHOT_FETCHER', snapshot)(row['url'], row['keyword'])
                digest = hashlib.sha256(result['text'].encode()).hexdigest()
                changed = digest != row['content_hash']
                with db() as connection:
                    connection.execute('UPDATE monitors SET checked_at=?,last_error=NULL,status=?,latency_ms=?,truncated=?,content_hash=?,changed_at=CASE WHEN ? THEN ? ELSE changed_at END WHERE id=?',
                        (now, result['status'], result['latency_ms'], int(result['truncated']), digest, changed, now, monitor_id))
                    if changed:
                        connection.execute('INSERT INTO snapshots(monitor_id,text,created_at) VALUES(?,?,?)', (monitor_id, result['text'], now))
                        connection.execute('DELETE FROM snapshots WHERE monitor_id=? AND id NOT IN (SELECT id FROM snapshots WHERE monitor_id=? ORDER BY id DESC LIMIT 20)', (monitor_id, monitor_id))
                return {'ok': True, 'changed': changed, 'initial': row['content_hash'] is None}
            except (ValueError, subprocess.SubprocessError) as error:
                message = str(error)[:240] if isinstance(error, ValueError) else '本次连接超时或失败'
                with db() as connection:
                    connection.execute('UPDATE monitors SET checked_at=?,last_error=?,status=NULL WHERE id=?', (now, message, monitor_id))
                return {'ok': False, 'error': message}
        finally:
            lock.release()

    app.check_monitor = check_monitor

    @app.route(PREFIX + '/api/monitors', methods=['GET', 'POST'])
    @private
    def monitors():
        if request.method == 'GET':
            with db() as connection:
                return jsonify(items=[dict(row) for row in connection.execute('SELECT m.*,(SELECT COUNT(*) FROM snapshots WHERE monitor_id=m.id) AS snapshot_count FROM monitors m ORDER BY id DESC')])
        data = payload()
        url = public_url(data.get('url'), resolve=True)[0]
        interval = int(data.get('interval', 1800))
        if interval not in (900, 1800, 3600, 21600, 86400):
            abort(400, '请选择提供的检查间隔')
        keyword = str(data.get('keyword', '')).strip()
        if len(keyword) > 120:
            abort(400, '关注词过长')
        with db() as connection:
            capacity(connection, 'monitors', 12)
            cursor = connection.execute('INSERT INTO monitors(name,url,keyword,interval,created_at) VALUES(?,?,?,?,?)',
                (name_of(data, '新的关注'), url, keyword, interval, time.time()))
        return jsonify(id=cursor.lastrowid), 201

    @app.post(PREFIX + '/api/monitors/<int:item_id>/check')
    @private
    def check(item_id):
        rate_limit('check:' + str(item_id), 2, 30)
        with db() as connection:
            if not connection.execute('SELECT 1 FROM monitors WHERE id=?', (item_id,)).fetchone():
                abort(404)
        return jsonify(check_monitor(item_id))

    @app.route(PREFIX + '/api/monitors/<int:item_id>', methods=['PATCH', 'DELETE'])
    @private
    def monitor_update(item_id):
        with db() as connection:
            if request.method == 'DELETE':
                connection.execute('DELETE FROM monitors WHERE id=?', (item_id,))
            else:
                connection.execute('UPDATE monitors SET enabled=? WHERE id=?', (int(bool(payload().get('enabled'))), item_id))
        return jsonify(ok=True)

    @app.get(PREFIX + '/api/monitors/<int:item_id>/history')
    @private
    def history(item_id):
        with db() as connection:
            rows = [dict(row) for row in connection.execute('SELECT * FROM snapshots WHERE monitor_id=? ORDER BY id DESC LIMIT 20', (item_id,))]
        diff = ''
        if len(rows) > 1:
            diff = '\n'.join(list(difflib.unified_diff(rows[1]['text'].splitlines(), rows[0]['text'].splitlines(), fromfile='上次快照', tofile='最新快照', lineterm=''))[:240])[:32000]
        return jsonify(items=rows, diff=diff)

    @app.route(PREFIX + '/api/hooks', methods=['GET', 'POST'])
    @private
    def hooks():
        with db() as connection:
            if request.method == 'GET':
                rows = [dict(row) for row in connection.execute('SELECT h.*, (SELECT COUNT(*) FROM events WHERE hook_id=h.id) AS event_count FROM hooks h ORDER BY id DESC')]
                for row in rows:
                    row['url'] = app.config['PUBLIC_ORIGIN'] + PREFIX + '/hook/' + row.pop('token')
                return jsonify(items=rows)
            capacity(connection, 'hooks', 12)
            cursor = connection.execute('INSERT INTO hooks(name,token,created_at) VALUES(?,?,?)',
                (name_of(payload(), '新的信箱'), secrets.token_urlsafe(24), time.time()))
        return jsonify(id=cursor.lastrowid), 201

    @app.route(PREFIX + '/api/hooks/<int:item_id>', methods=['PATCH', 'DELETE'])
    @private
    def hook_update(item_id):
        with db() as connection:
            if request.method == 'DELETE':
                connection.execute('DELETE FROM hooks WHERE id=?', (item_id,))
            else:
                connection.execute('UPDATE hooks SET enabled=? WHERE id=?', (int(bool(payload().get('enabled'))), item_id))
        return jsonify(ok=True)

    @app.get(PREFIX + '/api/hooks/<int:item_id>/events')
    @private
    def events(item_id):
        with db() as connection:
            rows = [dict(row) for row in connection.execute('SELECT * FROM events WHERE hook_id=? AND created_at>? ORDER BY id DESC LIMIT 100', (item_id, time.time()-7*86400))]
        for row in rows:
            row['headers'] = json.loads(row['headers'])
        return jsonify(items=rows)

    @app.route(PREFIX + '/hook/<token>', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    def ingest(token):
        with db() as connection:
            row = connection.execute('SELECT id FROM hooks WHERE token=? AND enabled=1', (token,)).fetchone()
            if not row:
                abort(404, '此信箱不存在或已停用')
            rate_limit('hook:' + str(row['id']), 30, 60)
            body = request.get_data(cache=False)
            stored_headers = {key: '[已遮盖]' if SENSITIVE.search(key) else value[:1000] for key, value in request.headers.items() if key.lower() not in ('host', 'cf-connecting-ip', 'x-forwarded-for', 'x-real-ip')}
            headers_truncated = len(json.dumps(stored_headers).encode()) > 8192
            while len(json.dumps(stored_headers).encode()) > 7900:
                stored_headers.pop(next(reversed(stored_headers)))
            if headers_truncated:
                stored_headers['X-Yukino-Note'] = '请求头较长，仅保留前 8 KiB'
            query = urlencode([(key, '[已遮盖]' if SENSITIVE.search(key) else value[:500]) for key, value in parse_qsl(request.query_string.decode(errors='replace'), max_num_fields=100)])
            cursor = connection.execute('INSERT INTO events(hook_id,method,query,headers,body,bytes,truncated,created_at) VALUES(?,?,?,?,?,?,?,?)',
                (row['id'], request.method, query[:3000], json.dumps(stored_headers, ensure_ascii=False),
                 body[:16384].decode('utf-8', errors='replace'), len(body), len(body)>16384, time.time()))
            connection.execute('DELETE FROM events WHERE hook_id=? AND id NOT IN (SELECT id FROM events WHERE hook_id=? ORDER BY id DESC LIMIT 100)', (row['id'], row['id']))
        return jsonify(accepted=True, event_id=cursor.lastrowid), 202

    @app.route(PREFIX + '/api/links', methods=['GET', 'POST'])
    @private
    def links():
        with db() as connection:
            if request.method == 'GET':
                rows = [dict(row) for row in connection.execute('SELECT * FROM links ORDER BY id DESC')]
                for row in rows:
                    row['url'] = app.config['PUBLIC_ORIGIN'] + PREFIX + '/s/' + row['slug']
                    row['days'] = [dict(day) for day in connection.execute('SELECT day,count FROM visits WHERE link_id=? ORDER BY day DESC LIMIT 7', (row['id'],))]
                return jsonify(items=rows)
            data = payload()
            target = public_url(data.get('target'))[0]
            slug = str(data.get('slug') or secrets.token_urlsafe(6)).strip()
            if not re.fullmatch(r'[A-Za-z0-9_-]{3,32}', slug):
                abort(400, '短名需为 3–32 位字母、数字、下划线或短横线')
            days = int(data.get('days', 0))
            if days not in (0, 1, 7, 30):
                abort(400, '请选择提供的有效期')
            capacity(connection, 'links', 100)
            cursor = connection.execute('INSERT INTO links(slug,name,target,expires_at,created_at) VALUES(?,?,?,?,?)',
                (slug, name_of(data, slug), target, time.time()+days*86400 if days else None, time.time()))
        return jsonify(id=cursor.lastrowid), 201

    @app.route(PREFIX + '/api/links/<int:item_id>', methods=['PATCH', 'DELETE'])
    @private
    def link_update(item_id):
        with db() as connection:
            if request.method == 'DELETE':
                connection.execute('DELETE FROM links WHERE id=?', (item_id,))
            else:
                connection.execute('UPDATE links SET enabled=? WHERE id=?', (int(bool(payload().get('enabled'))), item_id))
        return jsonify(ok=True)

    @app.get(PREFIX + '/api/links/<int:item_id>/qr.svg')
    @private
    def qr(item_id):
        with db() as connection:
            row = connection.execute('SELECT slug FROM links WHERE id=?', (item_id,)).fetchone()
            if not row:
                abort(404)
        buffer = io.BytesIO()
        segno.make_qr(app.config['PUBLIC_ORIGIN'] + PREFIX + '/s/' + row['slug']).save(buffer, kind='svg', scale=6, border=4, dark='#33445d')
        buffer.seek(0)
        return send_file(buffer, mimetype='image/svg+xml', as_attachment=True, download_name='yukino-' + row['slug'] + '.svg')

    @app.get(PREFIX + '/s/<slug>')
    def redirect_link(slug):
        with db() as connection:
            row = connection.execute('SELECT * FROM links WHERE slug=?', (slug,)).fetchone()
            if not row or not row['enabled'] or row['expires_at'] and row['expires_at'] <= time.time():
                return render_template('expired.html'), 410
            if request.method != 'HEAD':
                day = datetime.now(timezone(timedelta(hours=8))).date().isoformat()
                connection.execute('UPDATE links SET clicks=clicks+1 WHERE id=?', (row['id'],))
                connection.execute('INSERT INTO visits(link_id,day,count) VALUES(?,?,1) ON CONFLICT(link_id,day) DO UPDATE SET count=count+1', (row['id'],day))
        response = app.response_class(status=302)
        response.headers['Location'] = row['target']
        return response

    def maintenance():
        with db() as connection:
            connection.execute('DELETE FROM events WHERE created_at<?', (time.time()-7*86400,))
            connection.execute('DELETE FROM visits WHERE day<?', ((datetime.now(timezone.utc)-timedelta(days=30)).date().isoformat(),))
            due = [row['id'] for row in connection.execute('SELECT id FROM monitors WHERE enabled=1 AND next_at<=? ORDER BY next_at LIMIT 4', (time.time(),))]
        for item_id in due:
            check_monitor(item_id)
    app.maintenance = maintenance

    @app.get(PREFIX + '/api/export')
    @private
    def export():
        with db() as connection:
            data = {table: [dict(row) for row in connection.execute('SELECT * FROM ' + table)]
                    for table in ('monitors', 'snapshots', 'hooks', 'events', 'links', 'visits')}
        response = jsonify(version=1, exported_at=time.time(), **data)
        response.headers['Content-Disposition'] = 'attachment; filename=yukino-lab-export.json'
        return response

    return app

def start_scheduler(app):
    def run():
        while True:
            try:
                app.maintenance()
            except Exception as error:
                app.logger.error('Scheduler failed: %s', type(error).__name__)
            time.sleep(30)
    threading.Thread(target=run, name='yukino-radar', daemon=True).start()
