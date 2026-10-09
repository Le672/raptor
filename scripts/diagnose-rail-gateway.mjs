import { spawn } from 'node:child_process';

// Only status and public railway query fields leave this process. Never emit
// raw Wrangler output, request headers, IP addresses, cookies or exception text.
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error('Existing Cloudflare deployment credentials are required');
}
const child = spawn(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'pages', 'deployment', 'tail',
  '--project-name', 'raptor', '--environment', 'production', '--format', 'json',
], { stdio: ['ignore', 'pipe', 'pipe'] });
let buffer = '', stopping = false, events = 0;
function emitEvent(value) {
  const request = value.event?.request;
  if (!request?.url) return;
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.pathname !== '/api/rail') return;
  const query = {};
  for (const key of ['mode', 'search', 'date', 'from', 'to', 'train']) {
    const v = url.searchParams.get(key);
    if (v && /^[A-Za-z0-9-]{1,32}$/.test(v)) query[key] = v;
  }
  events++;
  console.log(JSON.stringify({
    event: 'rail-request', timestamp: value.eventTimestamp, host: url.hostname,
    query, status: value.event?.response?.status, outcome: value.outcome,
    cpuTime: value.cpuTime, wallTime: value.wallTime,
    exceptions: (value.exceptions || []).map(e => /^[A-Za-z]{1,40}$/.test(e.name) ? e.name : 'Exception'),
  }));
}
function readJson(chunk) {
  buffer += chunk.toString();
  // Wrangler emits formatted JSON objects, separated by ordinary status lines.
  for (;;) {
    const start = buffer.indexOf('{');
    if (start < 0) { buffer = ''; return; }
    let depth = 0, quoted = false, escape = false, end = -1;
    for (let i = start; i < buffer.length; i++) {
      const char = buffer[i];
      if (quoted) {
        if (escape) escape = false;
        else if (char === '\\') escape = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) { end = i + 1; break; }
    }
    if (end < 0) { buffer = buffer.slice(start); if (buffer.length > 2_000_000) buffer = ''; return; }
    try { emitEvent(JSON.parse(buffer.slice(start, end))); } catch { /* Ignore CLI status text. */ }
    buffer = buffer.slice(end);
  }
}
child.stdout.on('data', readJson);
child.stderr.on('data', () => {});
child.on('error', () => { console.log(JSON.stringify({ event: 'tail-start-failed' })); process.exitCode = 1; });
const timer = setTimeout(() => { stopping = true; child.kill('SIGTERM'); }, 180_000);
child.on('exit', (code) => {
  clearTimeout(timer);
  console.log(JSON.stringify({ event: 'tail-finished', events, expectedStop: stopping, code }));
  if (!stopping && code !== 0) process.exitCode = 1;
});
console.log(JSON.stringify({ event: 'tail-starting', durationSeconds: 180 }));
