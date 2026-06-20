-- Add last tax change timestamp for cooldown enforcement (24h)
ALTER TABLE worlds
  ADD COLUMN IF NOT EXISTS last_tax_change timestamptz;

-- Backfill for existing worlds (treat as never changed)
UPDATE worlds SET last_tax_change = NOW() - INTERVAL '25 hours' WHERE last_tax_change IS NULL;
