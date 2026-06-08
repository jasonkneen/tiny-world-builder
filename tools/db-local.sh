#!/usr/bin/env bash
set -euo pipefail

# Provision a local Postgres database for `netlify dev`.
#
# The Netlify functions (netlify/functions/lib/db.mjs) resolve a connection
# string from NETLIFY_DB_URL / DATABASE_URL / POSTGRES_URL / NETLIFY_DATABASE_URL.
# There is no Neon extension installed, so local dev needs its own Postgres.
#
# This script (re)creates the database and applies every migration under
# netlify/database/migrations in timestamp order (both flat *.sql files and
# legacy <name>/migration.sql subdirectories).
#
# Usage:
#   tools/db-local.sh                 # drop + recreate + migrate
#   PGHOST=... PGPORT=... DB=... tools/db-local.sh
#
# Env overrides (with defaults):
#   PGHOST=localhost  PGPORT=5432  PGUSER=$USER  DB=tinyworld
#
# After running, ensure .env contains the printed NETLIFY_DATABASE_URL line and
# restart `netlify dev` (it only reads .env at startup).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT/netlify/database/migrations"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-$USER}"
DB="${DB:-tinyworld}"

# Prefer Homebrew libpq's psql if it's not already on PATH.
if ! command -v psql >/dev/null 2>&1; then
  export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
fi
command -v psql >/dev/null 2>&1 || { echo "error: psql not found (try: brew install libpq)" >&2; exit 1; }

psql_admin() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc "$1"; }
psql_db()    { psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" -f "$1"; }

echo "==> Target: postgres://$PGUSER@$PGHOST:$PGPORT/$DB"

# Verify the server is reachable before destroying anything.
if ! psql_admin "SELECT 1" >/dev/null 2>&1; then
  echo "error: cannot connect to Postgres at $PGHOST:$PGPORT as $PGUSER" >&2
  echo "       is it running? (brew services start postgresql@17)" >&2
  exit 1
fi

echo "==> Dropping and recreating database '$DB'"
psql_admin "DROP DATABASE IF EXISTS \"$DB\";" >/dev/null
psql_admin "CREATE DATABASE \"$DB\";" >/dev/null

# Build the ordered migration list: "<timestamp>\t<path>", sorted by timestamp.
# Flat files use the basename's leading digits; subdirs use the dir name's.
echo "==> Discovering migrations in $MIGRATIONS_DIR"
mapfile -t ORDERED < <(
  {
    for f in "$MIGRATIONS_DIR"/*.sql; do
      [ -e "$f" ] || continue
      ts="$(basename "$f" | grep -oE '^[0-9]+' || true)"
      [ -n "$ts" ] && printf '%s\t%s\n' "$ts" "$f"
    done
    for d in "$MIGRATIONS_DIR"/*/; do
      f="${d}migration.sql"
      [ -e "$f" ] || continue
      ts="$(basename "$d" | grep -oE '^[0-9]+' || true)"
      [ -n "$ts" ] && printf '%s\t%s\n' "$ts" "$f"
    done
  } | sort -k1,1n | cut -f2-
)

[ "${#ORDERED[@]}" -gt 0 ] || { echo "error: no migrations found under $MIGRATIONS_DIR" >&2; exit 1; }

for f in "${ORDERED[@]}"; do
  echo "    - $(basename "$(dirname "$f")")/$(basename "$f")"
  psql_db "$f" >/dev/null
done

TABLES="$(psql_admin "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null || echo '?')"
# Re-point to the new DB for the table count.
TABLES="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
WORLDS="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" -tAc "SELECT count(*) FROM worlds;" 2>/dev/null || echo '0')"

URL="postgres://$PGUSER@$PGHOST:$PGPORT/$DB"
echo "==> Done: ${#ORDERED[@]} migrations applied, $TABLES tables, $WORLDS worlds."
echo
echo "Add this to .env (if not already present), then restart 'netlify dev':"
echo "    NETLIFY_DATABASE_URL=$URL"

if [ -f "$ROOT/.env" ] && grep -q "^NETLIFY_DATABASE_URL=" "$ROOT/.env"; then
  echo
  echo "(.env already has a NETLIFY_DATABASE_URL line — verify it matches the above.)"
fi
