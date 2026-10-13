#!/bin/bash
# Sets the Obsidian sync to run on its own every hour while the Mac is on.
#
#   bash scripts/install-obsidian-sync.sh --vault ~/path/to/Vault [sync flags]
#   bash scripts/install-obsidian-sync.sh --uninstall
#
# Any flags after the installer's own go straight to sync-obsidian.mjs, so use
# the same ones you'd use by hand (--folder, --exclude, --tag, --min-chars).
# It installs a LaunchAgent: macOS's own way of running something on a
# schedule for one user. It runs once straight away, then hourly; an hour
# missed while the Mac was asleep runs when it wakes. Nothing runs while the
# Mac is off, and nothing is lost: the next run picks up every change.
set -euo pipefail

LABEL="com.personalhub.obsidian-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/personal-hub-obsidian-sync.log"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Stopped. The vault won't sync on its own any more; your notes in the Hub are untouched."
  exit 0
fi

if [[ " $* " != *" --vault "* ]]; then
  echo "Usage: bash scripts/install-obsidian-sync.sh --vault ~/path/to/Vault [--folder A,B] [--tag hub]" >&2
  exit 1
fi

if ! grep -q '^HUB_EMAIL=' "$REPO/scripts/.env.local" 2>/dev/null; then
  echo "scripts/.env.local needs HUB_EMAIL and HUB_PASSWORD first (see scripts/README.md)." >&2
  exit 1
fi

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "node isn't on your PATH. Install Node (https://nodejs.org) and run this again." >&2
  exit 1
fi

# Expand ~ in the vault path now: the job doesn't run in a shell that would.
ARGS=()
for a in "$@"; do ARGS+=("${a/#\~/$HOME}"); done

# A first run by hand, so a wrong path or password shows up here and not in a log.
echo "Checking the sync once (nothing is written)…"
HUB_NODE="$NODE" bash "$REPO/scripts/obsidian-sync-run.sh" "${ARGS[@]}" --dry-run | tail -n 5

xml() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' <<<"$1"; }

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
  echo '<plist version="1.0"><dict>'
  echo "  <key>Label</key><string>$LABEL</string>"
  echo '  <key>ProgramArguments</key><array>'
  echo '    <string>/bin/bash</string>'
  echo "    <string>$(xml "$REPO/scripts/obsidian-sync-run.sh")</string>"
  for a in "${ARGS[@]}"; do echo "    <string>$(xml "$a")</string>"; done
  echo '  </array>'
  echo '  <key>EnvironmentVariables</key><dict>'
  echo "    <key>HUB_NODE</key><string>$(xml "$NODE")</string>"
  echo '  </dict>'
  echo '  <key>StartInterval</key><integer>3600</integer>'
  echo '  <key>RunAtLoad</key><true/>'
  echo "  <key>StandardOutPath</key><string>$(xml "$LOG")</string>"
  echo "  <key>StandardErrorPath</key><string>$(xml "$LOG")</string>"
  echo '</dict></plist>'
} >"$PLIST"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo
echo "Done. Your vault now syncs to the Hub every hour while the Mac is on."
echo "Log: $LOG"
echo "To stop it: bash scripts/install-obsidian-sync.sh --uninstall"
