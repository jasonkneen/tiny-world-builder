-- Cap world grid sizes at the client-supported set [8, 10, 12, 16, 20].
--
-- Older seeds shipped 18x18 (11 worlds) and 22x22 (mixed-hollow) islands. The
-- client renderer only knows the discrete option set above (HOME_GRID_MAX = 20),
-- so coerceGridSize discarded an off-list size and the rendered board inherited a
-- stale leftover GRID. The result in-game: the board displayed far smaller than
-- the real map (often 8x8), the avatar sank through the surface (cells fell
-- outside the small terrain), and the central stargate was placed/rendered off
-- the board and could not be used.
--
-- Snap any off-list size UP to the nearest legal option that covers it (18 -> 20,
-- 22 -> 20) in BOTH the row metadata (grid_size) and the saved payload
-- (data.gridSize, which effectiveWorldGridSize treats as authoritative), and
-- refresh tile_count to match. Idempotent: re-running matches no rows.
WITH snapped AS (
  SELECT id,
    CASE
      WHEN grid_size <= 8  THEN 8
      WHEN grid_size <= 10 THEN 10
      WHEN grid_size <= 12 THEN 12
      WHEN grid_size <= 16 THEN 16
      ELSE 20
    END AS g
  FROM worlds
  WHERE grid_size NOT IN (8, 10, 12, 16, 20)
)
UPDATE worlds w
SET grid_size  = s.g,
    data       = jsonb_set(w.data, '{gridSize}', to_jsonb(s.g), true),
    tile_count = s.g * s.g,
    updated_at = NOW()
FROM snapped s
WHERE w.id = s.id;

-- Make every world's cells FIT its (now legal) grid: drop any cell whose x or z
-- is >= grid_size. Only mixed-hollow (old 22x22 -> 20) has an out-of-bounds outer
-- ring, but this is written generally + idempotently (handles both the [x,z,...]
-- tuple form and the {x,z,...} object form). Idempotent: after running, no world
-- has an out-of-bounds cell so the EXISTS guard matches nothing.
UPDATE worlds w
SET data = jsonb_set(w.data, '{cells}', COALESCE((
      SELECT jsonb_agg(c)
      FROM jsonb_array_elements(w.data->'cells') c
      WHERE COALESCE((c->>0)::int, (c->>'x')::int, 0) < w.grid_size
        AND COALESCE((c->>1)::int, (c->>'z')::int, 0) < w.grid_size
    ), '[]'::jsonb)),
    updated_at = NOW()
WHERE jsonb_typeof(w.data->'cells') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(w.data->'cells') c
    WHERE COALESCE((c->>0)::int, (c->>'x')::int, 0) >= w.grid_size
       OR COALESCE((c->>1)::int, (c->>'z')::int, 0) >= w.grid_size
  );
