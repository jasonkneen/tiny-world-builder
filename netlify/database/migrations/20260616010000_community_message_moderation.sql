-- Soft moderation for community messages. Hidden messages remain available to
-- moderators/admins for audit and restore, while regular readers do not see them.
ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS hidden_by INT REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS hidden_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS community_messages_hidden_idx ON community_messages (hidden_at);
