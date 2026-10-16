#!/bin/sh
set -eu
cd "$(dirname "$0")"
: "${BACKUP_S3_URI:?Set a private s3://bucket/prefix destination}"
backup_file=$(mktemp)
trap 'rm -f "$backup_file"' EXIT HUP INT TERM
chmod 600 "$backup_file"
docker compose --env-file .env -f compose.yml exec -T postgres pg_dump -U lifestrong_admin -d lifestrong -Fc > "$backup_file"
test -s "$backup_file"
docker compose --env-file .env -f compose.yml exec -T postgres pg_restore --list < "$backup_file" > /dev/null
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
aws s3 cp "$backup_file" "${BACKUP_S3_URI%/}/lifestrong-${backup_stamp}.dump" --sse AES256 --only-show-errors
printf 'Backup verified and uploaded at %s\n' "$backup_stamp"
