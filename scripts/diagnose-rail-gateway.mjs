// Only status and public railway query fields leave this process, never headers,
// IP addresses, cookies, unfiltered logs or exception text.
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error('Existing deployment credentials are required');
const projectUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/pages/projects/raptor`;
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, body, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000) });
  const data = await response.json();
  if (!response.ok || !data.success) {
    console.log(JSON.stringify({ event: 'tail-api-failed', status: response.status, codes: (data.errors || []).map(e => e.code) }));
    throw new Error('Cloudflare diagnostic API did not succeed');
  }
  return data.result;
}
const project = await api(projectUrl), deployment = project.canonical_deployment?.id;
if (!deployment) throw new Error('No production deployment to inspect');
console.log(JSON.stringify({ event: 'pages-project', domain: project.subdomain, deployment }));
const endpoint = `${projectUrl}/deployments/${encodeURIComponent(deployment)}/tails`;
const session = await api(endpoint, 'POST', JSON.stringify({}));
const socketUrl = new URL(session.url);
if (socketUrl.protocol !== 'wss:' || socketUrl.hostname !== 'tail.developers.workers.dev') throw new Error('Unexpected Cloudflare diagnostic endpoint');
let events = 0, stopping = false;
const socket = new WebSocket(session.url, 'trace-v1');
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
  const failures = (value.logs || []).flatMap(log => {
    if (!Array.isArray(log.message) || log.message[0] !== 'rail-gateway-failure') return [];
    try {
      const detail = JSON.parse(log.message[1]);
      return [{ upstreamStatus: Number.isInteger(detail.upstreamStatus) ? detail.upstreamStatus : undefined,
        tags: Array.isArray(detail.tags) ? detail.tags.filter(tag => ['会话', '余票数据', '无法识别', '查询地址', '超时', '繁忙', '非法', '预售', '日期', '未登录'].includes(tag)) : [] }];
    } catch { return []; }
  });
  console.log(JSON.stringify({
    event: 'rail-request', timestamp: value.eventTimestamp, host: url.hostname,
    query, status: value.event?.response?.status, outcome: value.outcome,
    cpuTime: value.cpuTime, wallTime: value.wallTime,
    exceptions: (value.exceptions || []).map(e => /^[A-Za-z]{1,40}$/.test(e.name) ? e.name : 'Exception'), failures,
  }));
}
try {
  await new Promise(resolve => {
    const timer = setTimeout(() => { stopping = true; socket.close(); resolve(); }, 180_000);
    socket.addEventListener('open', () => { socket.send(JSON.stringify({ debug: false })); console.log(JSON.stringify({ event: 'tail-starting', durationSeconds: 180 })); });
    socket.addEventListener('message', async event => {
      try { const raw = typeof event.data === 'string' ? event.data : await event.data.text(); emitEvent(JSON.parse(raw)); } catch { /* Never print unfiltered messages. */ }
    });
    socket.addEventListener('close', () => { clearTimeout(timer); resolve(); });
    socket.addEventListener('error', () => { clearTimeout(timer); process.exitCode = 1; resolve(); });
  });
  console.log(JSON.stringify({ event: 'tail-finished', events, expectedStop: stopping }));
} finally {
  socket.close();
  await api(`${endpoint}/${encodeURIComponent(session.id)}`, 'DELETE').catch(() => {});
}
// End the bounded diagnostic even if the remote socket's close handshake lingers.
process.exit(process.exitCode || 0);
