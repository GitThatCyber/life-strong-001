#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$#" -ne 1 ] || [ ! -s "$1" ]; then
  printf 'Usage: npm run verify:backup -- backups/your-backup.dump\n' >&2
  exit 1
fi
restore_dump=$1
restore_db="lifestrong_restore_$(date +%Y%m%d%H%M%S)_$$"
docker compose exec -T postgres createdb -U lifestrong "$restore_db"
# Cleanup is registered only after our uniquely named database is created.
cleanup() {
  restore_status=$?
  trap - EXIT HUP INT TERM
  if ! docker compose exec -T postgres dropdb -U lifestrong "$restore_db"; then
    printf 'Could not remove temporary restore database: %s\n' "$restore_db" >&2
    exit 1
  fi
  exit "$restore_status"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
docker compose exec -T postgres pg_restore -U lifestrong -d "$restore_db" --no-owner --exit-on-error < "$restore_dump"
docker compose exec -T postgres psql -U lifestrong -d "$restore_db" -v ON_ERROR_STOP=1 \
  -c 'SELECT filename FROM schema_migrations ORDER BY filename;' \
  -c 'SELECT count(*) AS exercises FROM exercises;' \
  -c 'SELECT status, count(*) AS sessions FROM workout_sessions GROUP BY status;'
printf 'PASS: backup restored and queried in temporary database %s; cleanup follows.\n' "$restore_db"
