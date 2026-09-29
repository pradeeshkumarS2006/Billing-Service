// TODO: load + validate env vars.
// TODO: pin pricing constants and plan limits here (integers only).
require('dotenv').config();

const PRICING = {
  API_CALL_CENTS: 1,           // 1 cent per API call, example — document your real numbers in README
  INPUT_TOKEN_MICRO: 2,        // micro-cents per input token
  CACHED_INPUT_TOKEN_MICRO: 1, // cheaper than fresh input
  OUTPUT_TOKEN_MICRO: 6,       // reasoning tokens billed at this rate too
};

const PLAN_LIMITS = {
  free: { api_call_limit: 1000, ai_token_limit: 100000 },
  pro:  { api_call_limit: 20000, ai_token_limit: 2000000 },
};

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  PRICING,
  PLAN_LIMITS,
};