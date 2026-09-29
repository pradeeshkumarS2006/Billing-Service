// TODO: record(tenant, type, qty, idempotencyKey)
// Duplicate key -> return the original result, create no new event.
const db = require('../config/db');

async function record(tenantId, type, quantity, idempotencyKey) {
  const existing = await db.query(
    'SELECT * FROM usage_events WHERE tenant_id = $1 AND idempotency_key = $2',
    [tenantId, idempotencyKey]
  );
  if (existing.rows.length > 0) {
    return { event: existing.rows[0], duplicate: true };
  }

  try {
    const result = await db.query(
      `INSERT INTO usage_events (tenant_id, type, quantity, idempotency_key)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, type, quantity, idempotencyKey]
    );
    return { event: result.rows[0], duplicate: false };
  } catch (err) {
    if (err.code === '23505') { // unique_violation — a race beat us to it
      const race = await db.query(
        'SELECT * FROM usage_events WHERE tenant_id = $1 AND idempotency_key = $2',
        [tenantId, idempotencyKey]
      );
      return { event: race.rows[0], duplicate: true };
    }
    throw err;
  }
}

module.exports = { record };