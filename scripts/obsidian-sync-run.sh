#!/bin/bash
# What the hourly job runs: load the sign-in from scripts/.env.local, then
# sync the vault with the flags the installer was given. Kept separate from
# the job itself so the job's file stays a plain list of arguments.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
source scripts/.env.local
set +a

NODE="${HUB_NODE:-$(command -v node || true)}"
if [ -z "$NODE" ]; then
  echo "$(date '+%F %T') node not found; reinstall the sync so it can record where node is." >&2
  exit 1
fi

echo "--- $(date '+%F %T') (node: $NODE)"
exec "$NODE" scripts/sync-obsidian.mjs "$@"
