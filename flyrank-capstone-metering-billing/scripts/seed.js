// TODO: insert plans (Free, Pro) and a demo tenant.
// scripts/seed.js
require('dotenv').config();
const db = require('../src/config/db');
const { PLAN_LIMITS } = require('../src/config');

async function seed() {
  // 1. Insert plans (idempotent — skip if they already exist)
  for (const [name, limits] of Object.entries(PLAN_LIMITS)) {
    await db.query(
      `INSERT INTO plans (name, api_call_limit, ai_token_limit)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING`,
      [name, limits.api_call_limit, limits.ai_token_limit]
    );
  }
  console.log('Plans seeded.');

  // 2. Get the free plan's id
  const planResult = await db.query('SELECT id FROM plans WHERE name = $1', ['free']);
  const freePlanId = planResult.rows[0].id;

  // 3. Insert a demo tenant on the free plan (only if none exists yet)
  const existing = await db.query('SELECT id FROM tenants WHERE name = $1', ['Demo Tenant']);
  if (existing.rows.length === 0) {
    const tenantResult = await db.query(
      `INSERT INTO tenants (name, plan_id) VALUES ($1, $2) RETURNING id`,
      ['Demo Tenant', freePlanId]
    );
    console.log('Demo tenant created with id:', tenantResult.rows[0].id);
  } else {
    console.log('Demo tenant already exists with id:', existing.rows[0].id);
  }

  await db.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});