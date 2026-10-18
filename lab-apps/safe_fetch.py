"""Public HTTP snapshots; DNS answers are validated and pinned for every hop."""
from html.parser import HTMLParser
from urllib.parse import urlsplit, urlunsplit, urljoin
from pathlib import Path
import ipaddress
import json
import socket
import subprocess
import tempfile
import time

MAX_BYTES = 512 * 1024

def public_url(value, resolve=False):
    if not isinstance(value, str) or len(value) > 2048 or any(ord(c) < 33 for c in value):
        raise ValueError('请输入完整的 HTTP 或 HTTPS 地址')
    parts = urlsplit(value)
    if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
        raise ValueError('仅支持不含账号密码的 HTTP 或 HTTPS 地址')
    try:
        port = parts.port or (443 if parts.scheme == 'https' else 80)
        if port not in (80, 443):
            raise ValueError('仅支持标准网页端口 80 和 443')
        host = parts.hostname.encode('idna').decode('ascii')
        if host.lower() == 'localhost' or '.' not in host:
            raise ValueError('不能使用本机或内网地址')
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if address is not None and not address.is_global:
            raise ValueError('不能使用本机、内网或保留地址')
        addresses = []
        if resolve:
            answers = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
            addresses = sorted({answer[4][0] for answer in answers})
            if not addresses or any(not ipaddress.ip_address(ip).is_global for ip in addresses):
                raise ValueError('域名解析到了内网或保留地址，已停止访问')
        return urlunsplit((parts.scheme, parts.netloc, parts.path or '/', parts.query, '')), host, port, addresses
    except (socket.gaierror, UnicodeError) as error:
        raise ValueError('域名暂时无法解析') from error

class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.lines = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'svg', 'noscript'):
            self.skip += 1
        if not self.skip and tag in ('p', 'div', 'li', 'h1', 'h2', 'h3', 'br', 'tr', 'section'):
            self.lines.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'svg', 'noscript') and self.skip:
            self.skip -= 1
        if not self.skip and tag in ('p', 'div', 'li', 'h1', 'h2', 'h3', 'tr'):
            self.lines.append('\n')
    def handle_data(self, data):
        if not self.skip:
            self.lines.append(data)

def snapshot(url, keyword=''):
    started = time.monotonic()
    for hop in range(4):
        url, host, port, addresses = public_url(url, resolve=True)
        with tempfile.TemporaryDirectory(prefix='yukino-radar-') as folder:
            headers = Path(folder) / 'headers'
            body = Path(folder) / 'body'
            command = ['curl', '-4', '--noproxy', '*', '--resolve', f'{host}:{port}:{addresses[0]}',
                '--proto', '=http,https', '--connect-timeout', '4', '--max-time', '10',
                '--max-filesize', str(MAX_BYTES), '-sS', '-D', str(headers), '-o', str(body),
                '-w', '%{http_code}', '-A', 'YukinoRadar/1.0 (+https://www.yukino.bond/)',
                '-H', 'Accept: text/html,text/plain,application/json,application/xml', '--url', url]
            response = subprocess.run(command, capture_output=True, timeout=13)
            if response.returncode:
                raise ValueError('页面超过 512 KiB' if response.returncode == 63 else
                    '连接失败或超时，请稍后再试（未跳过证书校验）')
            raw_headers = headers.read_text(errors='replace')
            header_map = dict((line.split(':', 1)[0].lower(), line.split(':', 1)[1].strip())
                for line in raw_headers.splitlines() if ':' in line)
            status = int(response.stdout)
            if status in (301, 302, 303, 307, 308) and header_map.get('location'):
                url = urljoin(url, header_map['location'])
                continue
            if status != 200:
                raise ValueError(f'站点返回 HTTP {status}，本次未更新快照')
            if body.stat().st_size > MAX_BYTES:
                raise ValueError('页面超过 512 KiB')
            content_type = header_map.get('content-type', '').lower()
            if not any(kind in content_type for kind in ['text/', 'json', 'xml']):
                raise ValueError('此地址不是可读取的文字页面')
            if header_map.get('content-encoding', 'identity') != 'identity':
                raise ValueError('站点强制返回压缩内容，暂不支持')
            text = body.read_bytes().decode('utf-8-sig', errors='replace')
        if 'html' in content_type:
            parser = TextOnly()
            parser.feed(text)
            text = ''.join(parser.lines)
        elif 'json' in content_type:
            try:
                text = json.dumps(json.loads(text), ensure_ascii=False, sort_keys=True, indent=2)
            except ValueError:
                pass
        lines = [' '.join(line.split()) for line in text.splitlines() if line.strip()]
        if keyword:
            lines = [line for line in lines if keyword.casefold() in line.casefold()]
            if not lines:
                raise ValueError('页面未找到关注词，请修改关注词后重试')
        text = '\n'.join(lines)
        if not text:
            raise ValueError('没有读到正文；需要运行 JavaScript 的页面暂不支持')
        return {'text': text[:40000], 'truncated': len(text) > 40000, 'status': status,
                'final_url': url, 'latency_ms': round((time.monotonic() - started) * 1000)}
    raise ValueError('重定向超过 3 次，已停止访问')
