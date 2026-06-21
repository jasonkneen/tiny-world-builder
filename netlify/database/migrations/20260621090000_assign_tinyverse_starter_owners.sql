-- Official Tinyverse starter islands are owned by Jason's production account.
-- If the account row does not exist yet, /api/worlds assigns them when that
-- profile next logs in.
UPDATE profiles
SET lobby_access = TRUE, updated_at = NOW()
WHERE LOWER(COALESCE(email, '')) = 'jason@bouncingfish.com';

WITH owner AS (
  SELECT id
  FROM profiles
  WHERE LOWER(COALESCE(email, '')) = 'jason@bouncingfish.com'
  ORDER BY id
  LIMIT 1
)
UPDATE worlds
SET owner_profile_id = owner.id, updated_at = NOW()
FROM owner
WHERE worlds.slug <> 'tinyverse-nexus'
  AND (worlds.kind = 'starter' OR (worlds.owner_profile_id IS NULL AND worlds.status IN ('published', 'draft')))
  AND worlds.owner_profile_id IS DISTINCT FROM owner.id;
