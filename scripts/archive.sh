#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p archives
archive="archives/life-strong-$(date +%Y%m%d-%H%M%S)-$$.tar.gz"
# Build the manifest first so a Git failure cannot produce a misleading archive.
manifest=$(mktemp)
trap 'rm -f "$manifest"' EXIT HUP INT TERM
git ls-files --cached --others --exclude-standard -z > "$manifest"
COPYFILE_DISABLE=1 tar --null -T "$manifest" -czf "$archive"
printf 'Created source archive: %s\n' "$archive"
