import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMailConfig } from '../../scripts/prepare-mail-deploy.mjs';
const settings = { compatibility_date: '2025-06-04', bindings: [
  { type: 'd1', name: 'db', id: 'existing-database' },
  { type: 'kv_namespace', name: 'kv', namespace_id: 'existing-kv' },
  { type: 'r2_bucket', name: 'r2', bucket_name: 'existing-attachments', jurisdiction: 'eu' },
  { type: 'send_email', name: 'email', allowed_destination_addresses: ['admin@example.test'], allowed_sender_addresses: ['mail@example.test'] },
  { type: 'service', name: 'service', service: 'existing-service', environment: 'production', entrypoint: 'MailService' },
  { type: 'ai', name: 'ai' }, { type: 'assets', name: 'assets' },
  { type: 'plain_text', name: 'jwt_secret', text: 'NEVER-COPY-PRIVATE-SETTING' },
  { type: 'secret_text', name: 'private', text: 'NEVER-COPY-SECRET' },
  { type: 'json', name: 'domain', json: ['NEVER-COPY-JSON'] },
] };
test('mail deployment preserves live storage/email bindings without copying private variable values', () => {
  const { config, safeBindings } = buildMailConfig(settings, { schedules: [{ cron: '0 16 * * *' }] }, '/source/mail-worker');
  assert.deepEqual(config.r2_buckets, [{ binding: 'r2', bucket_name: 'existing-attachments', jurisdiction: 'eu' }]);
  assert.equal(config.d1_databases[0].database_id, 'existing-database');
  assert.equal(config.kv_namespaces[0].id, 'existing-kv');
  assert.equal(config.send_email[0].name, 'email');
  assert.deepEqual(config.send_email[0].allowed_sender_addresses, ['mail@example.test']);
  assert.deepEqual(config.services, [{ binding: 'service', service: 'existing-service', environment: 'production', entrypoint: 'MailService' }]);
  assert.equal(config.keep_vars, true); assert.equal(config.build, undefined); assert.equal(config.vars, undefined);
  assert.equal(config.routes, undefined); assert.equal(config.route, undefined);
  assert(!JSON.stringify({ config, safeBindings }).includes('NEVER-COPY'));
});
test('only retired half-hour statistics cron is removed; maintenance stays intact', () => {
  const { config } = buildMailConfig(settings, { schedules: [{ cron: '*/30 * * * *' }, { cron: '0 16 * * *' }] });
  assert.deepEqual(config.triggers.crons, ['0 16 * * *']);
});
test('unknown live bindings or missing database/cache abort instead of detaching resources', () => {
  assert.throws(() => buildMailConfig({ bindings: [...settings.bindings, { type: 'unknown-resource', name: 'keep-me' }] }, []), /refusing to detach/);
  assert.throws(() => buildMailConfig({ bindings: [] }, []), /refusing to deploy/);
  assert.throws(() => buildMailConfig(settings, {}), /maintenance schedule/);
});
