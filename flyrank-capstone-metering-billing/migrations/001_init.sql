CREATE TABLE plans (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,          -- 'free' | 'pro'
  api_call_limit INTEGER NOT NULL,
  ai_token_limit INTEGER NOT NULL
);

CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL,               -- 'active' | 'canceled' | ...
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usage_events (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL,                 -- 'api_call' | 'ai_tokens'
  quantity INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)  -- <- this IS your idempotency guarantee
);
CREATE INDEX idx_usage_tenant_created ON usage_events (tenant_id, created_at);

CREATE TABLE processed_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);