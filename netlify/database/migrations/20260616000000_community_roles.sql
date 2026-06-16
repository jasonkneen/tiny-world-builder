-- Global community roles granted to a profile (distinct from the per-room
-- community_memberships.role). Lets admins promote members to moderator or
-- channel-creator from the UI. One row per (profile, role).
CREATE TABLE IF NOT EXISTS community_roles (
  profile_id  INT  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin','moderator','channel_creator')),
  granted_by  INT  REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, role)
);

CREATE INDEX IF NOT EXISTS community_roles_role_idx ON community_roles (role);
