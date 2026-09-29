// TODO: boundary tests (limit-1, limit, limit+1).
// tests/quota.test.js
const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/config/db');
const quotaService = require('../src/services/quotaService');
const meterService = require('../src/services/meterService');
const { PLAN_LIMITS } = require('../src/config');

async function makeTestTenant(planName = 'free') {
  const plan = await db.query('SELECT id FROM plans WHERE name = $1', [planName]);
  const result = await db.query(
    `INSERT INTO tenants (name, plan_id) VALUES ($1, $2) RETURNING id`,
    [`test-tenant-${Date.now()}-${Math.random()}`, plan.rows[0].id]
  );
  return result.rows[0].id;
}

// Fills usage up to `count` events of 1 unit each, using unique keys
async function fillUsage(tenantId, type, count) {
  for (let i = 0; i < count; i++) {
    await meterService.record(tenantId, type, 1, `fill-${tenantId}-${type}-${i}`);
  }
}

test('request that lands exactly on the limit is allowed', async () => {
  const tenantId = await makeTestTenant('free');
  const limit = PLAN_LIMITS.free.api_call_limit;

  // use up limit - 1, then ask for the last 1 unit -> should land exactly ON the limit
  await fillUsage(tenantId, 'api_call', limit - 1);

  const { allowed, used, limit: returnedLimit } = await quotaService.checkQuota(
    tenantId, 'free', 'api_call', 1
  );

  assert.strictEqual(used, limit - 1);
  assert.strictEqual(returnedLimit, limit);
  assert.strictEqual(allowed, true, 'the request that lands exactly on the limit must be allowed');
});

test('request that would exceed the limit by 1 is rejected', async () => {
  const tenantId = await makeTestTenant('free');
  const limit = PLAN_LIMITS.free.api_call_limit;

  // use up the full limit
  await fillUsage(tenantId, 'api_call', limit);

  const { allowed, used, limit: returnedLimit } = await quotaService.checkQuota(
    tenantId, 'free', 'api_call', 1
  );

  assert.strictEqual(used, limit);
  assert.strictEqual(returnedLimit, limit);
  assert.strictEqual(allowed, false, 'a request past the limit must be