const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) throw new Error('Cloudflare deployment credentials are required');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function storageError(action, { response, data }) {
  // Only emit numeric API error codes, never credentials or a raw account response.
  const codes = (data.errors ?? []).map(error => Number(error.code)).filter(Number.isFinite);
  const reason = codes.includes(10042)
    ? 'R2 is not enabled for this account. Complete the R2 activation in the Cloudflare dashboard before retrying.'
    : 'Check that the deployment token has Account > Workers R2 Storage > Edit for the deployment account and that R2 is enabled.';
  return new Error(`Cannot ${action} private game storage (HTTP ${response.status}; Cloudflare codes: ${codes.join(', ') || 'unavailable'}). ${reason}`);
}

const existing = await request(endpoint + '/yukino-games-saves');
if (existing.response.ok && existing.data.success) {
  console.log('Private game save bucket is already configured.');
} else {
  const missing = existing.response.status === 404 || existing.data.errors?.some(error => error.code === 10006);
  if (!missing) throw storageError('inspect', existing);
  const created = await request(endpoint, { method: 'POST', body: JSON.stringify({ name: 'yukino-games-saves' }) });
  if (!created.response.ok || !created.data.success) throw storageError('create', created);
  console.log('Created private game save storage.');
}
