// TODO: usage + requested vs plan limit. Decide the boundary rule first.
// src/services/quotaService.js
const db = require('../config/db');
const { PLAN_LIMITS } = require('../config');

async function checkQuota(tenantId, planName, type, requestedQty) {
  // 1. sum this month's usage for this tenant+type
  const result = await db.query(
    `SELECT COALESCE(SUM(quantity), 0) AS used
     FROM usage_events
     WHERE tenant_id = $1 AND type = $2
       AND created_at >= date_trunc('month', now())`,
    [tenantId, type]
  );
  const used = parseInt(result.rows[0].used, 10);

  // 2. get the limit for this plan + type
  const limitKey = type === 'api_call' ? 'api_call_limit' : 'ai_token_limit';
  const limit = PLAN_LIMITS[planName][limitKey];

  // 3. your rule: at-the-limit succeeds, over it fails
  const allowed = (used + requestedQty) <= limit;

  return { allowed, used, limit };
}

module.exports = { checkQuota };