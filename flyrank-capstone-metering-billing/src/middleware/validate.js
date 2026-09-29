// TODO: bad input -> clean 4xx, never a 500.
// src/middleware/validate.js

// Usage: validate({ quantity: 'positiveInt', type: 'string' })
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(schema)) {
      const value = req.body[field];

      if (value === undefined || value === null || value === '') {
        errors.push(`${field} is required`);
        continue;
      }

      if (rule === 'positiveInt') {
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) {
          errors.push(`${field} must be a positive integer`);
        }
      }

      if (rule === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
  };
}

module.exports = validate;