// TODO: POST /generate - validate input, read Idempotency-Key header, call service.
// src/routes/generate.js
const express = require('express');
const router = express.Router();
const meterService = require('../services/meterService');
const quotaService = require('../services/quotaService');

router.post('/generate', async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;        // set by your auth middleware
    const planName = req.tenant.planName;  // also from auth middleware / a tenant lookup
    const type = 'ai_tokens';              // or req.body.type if you support both
    const requestedQty = req.body.quantity;
    const idempotencyKey = req.headers['idempotency-key'];

    if (!requestedQty || !idempotencyKey) {
      return res.status(400).json({ error: 'quantity and Idempotency-Key header are required' });
    }

    const { allowed, used, limit } = await quotaService.checkQuota(tenantId, planName, type, requestedQty);
    if (!allowed) {
      return res.status(429).json({ error: 'Quota exceeded', used, limit });
    }

    const { event, duplicate } = await meterService.record(tenantId, type, requestedQty, idempotencyKey);
    res.status(duplicate ? 200 : 201).json({ event, duplicate });
  } catch (err) {
    next(err);
  }
});

module.exports = router;