// TODO: same request twice -> one event.
// tests/metering.test.js
const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/config/db');
const meterService = require('../src/services/meterService');

// Helper: make a throwaway tenant so tests don't collide with your seeded demo data
async function makeTestTenant() {
  const plan = await db.query(`SELECT id FROM plans WHERE name = 'free'`);
  const result = await db.query(
    `INSERT INTO tenants (name, plan_id) VALUES ($1, $2) RETURNING id`,
    [`test-tenant-${Date.now()}-${Math.random()}`, plan.rows[0].id]
  );
  return result.rows[0].id;
}

test('recording a new usage event creates exactly one row', async () => {
  const tenantId = await makeTestTenant();
  const key = 'key-' + Date.now();

  const { event, duplicate } = await meterService.record(tenantId, 'api_call', 1, key);

  assert.strictEqual(duplicate, false);
  assert.strictEqual(event.tenant_id, tenantId);

  const count = await db.query(
    'SELECT COUNT(*) FROM usage_events WHERE tenant_id = $1 AND idempotency_key = $2',
    [tenantId, key]
  );
  assert.strictEqual(Number(count.rows[0].count), 1);
});

test('same idempotency key sent twice creates only one event', async () => {
  const tenantId = await makeTestTenant();
  const key = 'key-' + Date.now();

  const first = await meterService.record(tenantId, 'api_call', 1, key);
  const second = await meterService.record(tenantId, 'api_call', 1, key);

  assert.strictEqual(first.duplicate, false);
  assert.strictEqual(second.duplicate, true);
  // second response mirrors the first — same event id
  assert.strictEqual(second.event.id, first.event.id);

  const count = await db.query(
    'SELECT COUNT(*) FROM usage_events WHERE tenant_id = $1 AND idempotency_key = $2',
    [tenantId, key]
  );
  assert.strictEqual(Number(count.rows[0].count), 1, 'must never create a second row for the same key');
});

test('two concurrent requests with the same key still create only one event', async () => {
  // This is the race-condition path — tests the catch(23505) branch in meterService
  const tenantId = await makeTestTenant();
  const key = 'race-key-' + Date.now();

  const [r1, r2] = await Promise.all([
    meterService.record(tenantId, 'api_call', 1, key),
    meterService.record(tenantId, 'api_call', 1, key),
  ]);

  // exactly one of the two should be the "original", the other a duplicate
  const duplicateCount = [r1.duplicate, r2.duplicate].filter(Boolean).length;
  assert.strictEqual(duplicateCount, 1);

  const count = await db.query(
    'SELECT COUNT(*) FROM usage_events WHERE tenant_id = $1 AND idempotency_key = $2',
    [tenantId, key]
  );
  assert.strictEqual(Number(count.rows[0].count), 1);
});

test('different idempotency keys create separate events', async () => {
  const tenantId = await makeTestTenant();

  await meterService.record(tenantId, 'api_call', 1, 'key-a-' + Date.now());
  await meterService.record(tenantId, 'api_call', 1, 'key-b-' + Date.now());

  const count = await db.query('SELECT COUNT(*) FROM usage_events WHERE tenant_id = $1', [tenantId]);
  assert.strictEqual(Number(count.rows[0].count), 2);
});

test.after(async () => {
  await db.end();
});