-- AI1 — paid AI generations. Each generation is metered in Earned GOLD (Coins). This
-- table is the idempotency + audit surface: a retried request with the same
-- (profile, key) returns the original result instead of re-charging or re-calling the
-- provider.
CREATE TABLE IF NOT EXISTS ai_generations (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  cost BIGINT NOT NULL,
  input_hash TEXT NOT NULL,                  -- binds a key to its (kind+input) request
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_generations_profile_key
  ON ai_generations (profile_id, idempotency_key);
