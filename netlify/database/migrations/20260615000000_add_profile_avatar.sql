-- Store each account's chosen voxel avatar descriptor on its profile so the
-- look follows the player across devices/browsers. Nullable + backward-
-- compatible: existing rows keep NULL (treated as "no avatar picked yet").
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar JSONB DEFAULT NULL;
