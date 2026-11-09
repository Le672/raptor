import { describe, it, expect } from 'vitest';
import { onRequest } from '../../functions/api/theme';
describe('visitor IP time zone endpoint', () => {
  it('uses trusted Cloudflare metadata, returns no IP, and is never shared-cached', async () => {
    const request = new Request('https://www.yukino.bond/api/theme', { headers: { Origin: 'https://lab.yukino.bond', 'X-Timezone': 'Europe/London', 'CF-Connecting-IP': '203.0.113.2' } });
    Object.assign(request, { cf: { timezone: 'Asia/Kathmandu' } });
    const response = onRequest({ request }); const data = await response.json();
    expect(data).toMatchObject({ timeZone: 'Asia/Katmandu', source: 'ip' });
    expect(Object.keys(data).sort()).toEqual(['now', 'source', 'timeZone']);
    expect(response.headers.get('Cache-Control')).toContain('private, no-store');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://lab.yukino.bond');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });
  it('rejects untrusted origins and does not infer a zone from caller headers', async () => {
    const response = onRequest({ request: new Request('https://www.yukino.bond/api/theme', { headers: { Origin: 'https://yukino.bond.evil.example', 'X-Timezone': 'Asia/Tokyo' } }) });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(await response.json()).toMatchObject({ timeZone: null, source: 'unavailable' });
  });
  it('handles invalid zones, HEAD requests, and unsupported methods', async () => {
    const request = new Request('https://www.yukino.bond/api/theme'); Object.assign(request, { cf: { timezone: 'Unknown/Zone' } });
    expect((await onRequest({ request }).json()).source).toBe('unavailable');
    expect(await onRequest({ request: new Request(request.url, { method: 'HEAD' }) }).text()).toBe('');
    expect(onRequest({ request: new Request(request.url, { method: 'POST' }) }).status).toBe(405);
  });
});
