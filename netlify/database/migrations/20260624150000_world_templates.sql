-- T2 — world templates. An owner can list a world as a template with an Earned GOLD
-- (Coins) price; others pay to remix it (duplicate into their own editable copy).
-- Builds on EC1 (coin_ledger) for the payment + author payout.
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS template_price BIGINT;          -- in Earned GOLD; NULL unless listed
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS template_author_id BIGINT REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS remix_count INTEGER NOT NULL DEFAULT 0;

-- Price bounds: a listed template must have a non-negative, sane price.
DO $$ BEGIN
  ALTER TABLE worlds ADD CONSTRAINT worlds_template_price_ck
    CHECK (template_price IS NULL OR (template_price >= 0 AND template_price <= 1000000));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_worlds_is_template ON worlds (is_template) WHERE is_template = TRUE;
