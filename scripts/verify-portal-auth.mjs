import assert from 'node:assert/strict';
import { verifyContentSession } from './verify-content-session.mjs';

const response = await fetch('https://www.yukino.bond/api/auth/access', { redirect: 'manual', signal: AbortSignal.timeout(20000) });
assert.equal(response.status, 401, 'The portal identity endpoint must run its API instead of returning the SPA shell');
assert.match(response.headers.get('Content-Type') || '', /application\/json/);
for (const site of ['cinema', 'comic', 'novel']) await verifyContentSession(`https://${site}.yukino.bond`);
console.log('Portal identity API and three VPS identity round trips verified.');
