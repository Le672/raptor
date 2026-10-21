import assert from 'node:assert/strict';

// An untrusted, deliberately forged session exercises Worker -> portal fetch.
// Anonymous probes alone cannot detect an unavailable identity service.
export async function verifyContentSession(origin) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId: 1, exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url');
  const token = `${header}.${payload}.${Buffer.alloc(32).toString('base64url')}`;
  let failure;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(`${origin}/api/access`, {
        headers: { Cookie: `__Secure-yukino_session=${token}` },
        redirect: 'manual', signal: AbortSignal.timeout(20000),
      });
      assert.equal(response.status, 200, 'Content Worker must reach the portal and reject forged sessions without an identity outage');
      assert.equal((await response.json()).user, null, 'A forged session must never authenticate');
      assert.match(response.headers.get('Cache-Control') || '', /no-store/);
      console.log(`${origin}: portal identity round trip verified; forged session rejected`);
      return;
    } catch (error) {
      failure = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  throw failure;
}
