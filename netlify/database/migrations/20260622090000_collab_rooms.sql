CREATE TABLE IF NOT EXISTS collab_rooms (
  room_id TEXT PRIMARY KEY,
  share_id TEXT,
  name TEXT NOT NULL DEFAULT 'Shared build',
  host_name TEXT NOT NULL DEFAULT 'Builder',
  location TEXT NOT NULL DEFAULT '',
  party_host TEXT NOT NULL DEFAULT '',
  observer_count INTEGER NOT NULL DEFAULT 0,
  player_count INTEGER NOT NULL DEFAULT 0,
  editor_count INTEGER NOT NULL DEFAULT 0,
  network_quality TEXT NOT NULL DEFAULT 'unknown',
  rtt_ms INTEGER,
  href TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS collab_rooms_last_seen_idx ON collab_rooms (last_seen DESC);
