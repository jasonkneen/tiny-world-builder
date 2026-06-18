-- WAVE launch taxonomy (Phase 2): tag roadmap milestones and feature suggestions
-- with a launch-wave label (WAVE1 / WAVE2 / WAVE3; NULL = none). WAVE1 is the
-- launch wave tied to the countdown target. Additive and idempotent.
--
-- roadmap_milestones / feature_suggestions are created LAZILY by their Netlify
-- functions (ensureTable/ensureTables in roadmap.mjs / features.mjs), not by an
-- earlier migration — so a plain ALTER would fail on a database where the
-- function has never run yet. Guard on table existence: this migration adds the
-- column where the table already exists (e.g. prod), and the functions' own
-- idempotent ALTER adds it on first call for fresh databases.
DO $$
BEGIN
  IF to_regclass('public.roadmap_milestones') IS NOT NULL THEN
    ALTER TABLE roadmap_milestones ADD COLUMN IF NOT EXISTS wave TEXT;
  END IF;
  IF to_regclass('public.feature_suggestions') IS NOT NULL THEN
    ALTER TABLE feature_suggestions ADD COLUMN IF NOT EXISTS wave TEXT;
  END IF;
END $$;
