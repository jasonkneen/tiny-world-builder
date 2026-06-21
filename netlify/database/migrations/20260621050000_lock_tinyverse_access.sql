-- Tinyverse/lobby access is invite-only again. Keep world-admin status separate:
-- the Gmail account can enter Tinyverse without becoming a world admin.
ALTER TABLE profiles
  ALTER COLUMN lobby_access SET DEFAULT FALSE;

UPDATE profiles
SET lobby_access = CASE
  WHEN LOWER(COALESCE(email, '')) IN (
    'jason@bouncingfish.com',
    'jason.kneen@bouncingfish.com',
    'jason.kneen@gmail.com'
  ) THEN TRUE
  ELSE FALSE
END;
