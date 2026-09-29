// TODO: identify the tenant for each request.
// src/middleware/auth.js
const db = require('../config/db');

async function auth(req, res, next) {
  try {
    const tenantId = req.headers['tenant-id'];
    if (!tenantId) {
      return res.status(401).json({ error: 'tenant-id header is required' });
    }

    const result = await db.query(
      `SELECT t.id, t.name, p.name AS plan_name
       FROM tenants t
       JOIN plans p ON p.id = t.plan_id
       WHERE t.id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unknown tenant' });
    }

    req.tenant = { id: result.rows[0].id, planName: result.rows[0].plan_name };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = auth;