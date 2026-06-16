-- Social handles on each profile. Twitter/X is mandatory for community
-- participation (enforced in the app); GitHub is optional. Stored without the
-- leading '@' or any URL prefix — just the bare handle. Nullable-safe: existing
-- rows default to '' (treated as "not set yet").
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github  TEXT NOT NULL DEFAULT '';
