// Export only anonymous speed runs. The private decryption key never enters CI.
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { randomBytes, createCipheriv, publicEncrypt, constants } from 'node:crypto';
await mkdir('.wrangler/speed-migration', { recursive: true });
const file = '.wrangler/speed-migration/speed.sql';
try {
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'export', 'yukino-portal', '--remote', '--table', 'speed_runs', '--output', file],
    { stdio: 'pipe', timeout: 180000, maxBuffer: 5 * 1024 * 1024 });
} catch { throw new Error('Speed table export failed; no private response was logged'); }
const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
const input = gzipSync(await readFile(file));
const body = Buffer.concat([cipher.update(input), cipher.final()]);
const envelope = { version: 1, key: publicEncrypt({ key: await readFile('vps-content/export-public.pem'), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64'),
  iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), body: body.toString('base64') };
// Send the encrypted table ONLY to the user's already deployed VPS inbox.
// Neither SQL nor ciphertext is written to public artifacts or job logs.
const { destination } = JSON.parse(await readFile('vps-content/migration-target.json', 'utf8'));
if (!/^https:\/\/tools\.yukino\.bond\/lab\/hook\/[\w-]+$/.test(destination)) throw new Error('Unexpected migration destination');
const encoded = Buffer.from(JSON.stringify(envelope)).toString('base64');
for (let offset = 0; offset < encoded.length; offset += 6000) {
  const response = await fetch(destination, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ part: offset / 6000, total: Math.ceil(encoded.length / 6000), chunk: encoded.slice(offset, offset + 6000) }) });
  if (!response.ok) throw new Error('Private transfer to the authorized VPS did not succeed');
}
console.log('Encrypted speed data sent directly to the existing tools.yukino.bond VPS inbox; no data was logged.');
