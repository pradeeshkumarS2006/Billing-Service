// TODO: central error handler.
// src/middleware/errors.js
function errorHandler(err, req, res, next) {
  console.error(err);

  // Postgres unique_violation slipping through somewhere unexpected
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Conflict', detail: 'Duplicate resource' });
  }

  // Postgres foreign_key_violation (e.g. unknown tenant_id)
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Invalid reference', detail: err.detail });
  }

  // Stripe errors carry a .statusCode
  if (err.statusCode && err.type && err.type.startsWith('Stripe')) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Anything else -> generic 500, never leak stack traces to the client
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;