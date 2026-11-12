const origin = new URL(process.argv[2] || 'https://speed.yukino.bond');
if (origin.protocol !== 'https:') throw new Error('Deployment verification requires HTTPS');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    const page = await fetch(origin, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!page.ok || !(await page.text()).includes('Yukino Speed')) throw new Error(`Website check failed: HTTP ${page.status}`);
    const response = await fetch(new URL('/api/speed/totals', origin), { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Statistics check failed: HTTP ${response.status}`);
    const totals = await response.json();
    if (!Number.isSafeInteger(totals.bytes) || totals.bytes < 0 || !Number.isSafeInteger(totals.sessions) || totals.sessions < 0 || totals.source !== 'anonymous-client-reports') throw new Error('Invalid statistics response');
    console.log(JSON.stringify({ origin: origin.origin, https: 'verified', website: page.status, statistics: response.status, bytes: totals.bytes, sessions: totals.sessions }));
    break;
  } catch (error) {
    if (attempt === 12) throw error;
    console.log(`Waiting for the production endpoint (${attempt}/12): ${error.message}`);
    await pause(5000);
  }
}
