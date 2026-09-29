// TODO: hand-computed token cost cases.
// src/services/costService.js
const { PRICING } = require('../config');

// tokens = { input, cachedInput, output, reasoning }
function calculateTokenCost(tokens) {
  const { input = 0, cachedInput = 0, output = 0, reasoning = 0 } = tokens;

  // reasoning tokens are billed at the OUTPUT rate, not a separate category
  const billableOutput = output + reasoning;

  const cost =
    input * PRICING.INPUT_TOKEN_MICRO +
    cachedInput * PRICING.CACHED_INPUT_TOKEN_MICRO +
    billableOutput * PRICING.OUTPUT_TOKEN_MICRO;

  return cost; // in micro-cents, integer
}

function calculateApiCallCost(count) {
  return count * PRICING.API_CALL_CENTS; // in cents, integer
}

module.exports = { calculateTokenCost, calculateApiCallCost };