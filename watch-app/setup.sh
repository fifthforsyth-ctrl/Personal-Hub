#!/bin/bash
# Gets the Hub watch app ready to install from Xcode on this Mac.
#
#   ./setup.sh                  uses the watch address on your clipboard
#   ./setup.sh --address URL    or the one you give it
#   ./setup.sh --check          also builds it once to check it compiles
#
# 1. Writes Shared/Secrets.swift with your watch address (copy it in the
#    Hub: More > On your watch > Copy address). It stays on this Mac.
# 2. Writes Local.xcconfig: an app id unique to you, and your signing team
#    if Xcode already has one.
# 3. Makes HubWatch.xcodeproj with XcodeGen (downloaded here if needed)
#    and opens it in Xcode.
set -euo pipefail
cd "$(dirname "$0")"

ADDRESS="${HUB_WATCH_ADDRESS:-}"
CHECK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --address) ADDRESS="${2:-}"; shift 2 ;;
    --check) CHECK=1; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

looks_right() {
  case "$1" in https://*/functions/v1/watch\?key=*) return 0 ;; *) return 1 ;; esac
}

# 1. The watch address.
if [ -z "$ADDRESS" ] && command -v pbpaste >/dev/null; then
  CLIP="$(pbpaste | tr -d '[:space:]')"
  if looks_right "$CLIP"; then ADDRESS="$CLIP"; echo "Using the watch address on your clipboard."; fi
fi
# A placeholder (from a --check run) doesn't count as set up.
if [ -f Shared/Secrets.swift ] && grep -q YOUR_KEY Shared/Secrets.swift; then
  [ "$CHECK" = 1 ] || rm Shared/Secrets.swift
fi
if [ -z "$ADDRESS" ] && [ -f Shared/Secrets.swift ]; then
  echo "Keeping the watch address already set up."
elif [ -z "$ADDRESS" ] && [ "$CHECK" = 1 ]; then
  cp Secrets.swift.example Shared/Secrets.swift
  echo "No address needed just to check the build; using a placeholder."
elif [ -z "$ADDRESS" ] && [ -t 0 ]; then
  echo "Paste your watch address (Hub > More > On your watch > Copy address), then press Return:"
  read -r ADDRESS
fi
if [ -n "$ADDRESS" ]; then
  ADDRESS="$(printf '%s' "$ADDRESS" | tr -d '[:space:]')"
  if ! looks_right "$ADDRESS"; then
    echo "That doesn't look like the watch address. It starts with https:// and ends in watch?key=…"
    exit 1
  fi
  cat > Shared/Secrets.swift <<EOF
// Written by setup.sh. Not in git: it holds your private watch key.
enum Secrets {
    static let watchAddress = "$ADDRESS"
}
EOF
  echo "Saved the watch address."
fi
if [ ! -f Shared/Secrets.swift ]; then
  echo "No watch address yet. Copy it in the Hub (More > On your watch > Copy address) and run ./setup.sh again."
  exit 1
fi

# 2. App id and signing team.
if [ ! -f Local.xcconfig ]; then
  WHO="$(id -un | tr -cd '[:alnum:]' | tr '[:upper:]' '[:lower:]')"
  TEAM="$(security find-certificate -a -c "Apple Development" -p 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null \
    | sed -n 's/.*OU *= *\([A-Z0-9]\{10\}\).*/\1/p' | head -1 || true)"
  cat > Local.xcconfig <<EOF
// Written by setup.sh. Not in git.
HUB_BUNDLE_ID = com.${WHO:-me}.hubwatch
DEVELOPMENT_TEAM = ${TEAM}
EOF
  if [ -n "$TEAM" ]; then
    echo "Signing with team $TEAM."
  else
    echo "No signing team found yet. In Xcode, pick your Team under Signing & Capabilities for both targets."
  fi
fi

# 3. The Xcode project.
if command -v xcodegen >/dev/null; then
  XG="xcodegen"
elif [ -x .tools/xcodegen/bin/xcodegen ]; then
  XG=".tools/xcodegen/bin/xcodegen"
else
  echo "Getting XcodeGen (it makes the Xcode project)…"
  mkdir -p .tools
  curl -fsSL -o .tools/xcodegen.zip https://github.com/yonaskolb/XcodeGen/releases/latest/download/xcodegen.zip
  (cd .tools && unzip -oq xcodegen.zip)
  XG=".tools/xcodegen/bin/xcodegen"
fi
"$XG" generate --spec project.yml

if [ "$CHECK" = 1 ]; then
  echo "Building once to check it compiles…"
  xcodebuild -project HubWatch.xcodeproj -scheme HubWatch -destination 'generic/platform=watchOS' \
    -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet
  echo "It builds."
else
  open HubWatch.xcodeproj
  echo "Opened in Xcode. Pick your watch at the top, then press Run (▶)."
fi
