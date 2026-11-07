#!/usr/bin/env bash
# Load lre/proot/pins.env into the job env and show it. pins.env is the one
# place proot's versions live (proot.yml has no copy of them); this exports
# each KEY=value line to $GITHUB_ENV (when set), so later steps can use e.g.
# ${{ env.NDK_VERSION }}, and prints the pins as a markdown table.
# Values must be plain literals: anything else would be evaluated by the
# scripts that source the file, so it fails here first.
#
# Usage (repo root): bash .github/ci/proot/pins.sh
#   markdown on stdout, exit 1 on a malformed line.
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/../../.."

PINS=lre/proot/pins.env
lines="$(grep -E '^[A-Z][A-Z0-9_]*=' "$PINS")"
bad="$(grep -vE '^[A-Z][A-Z0-9_]*=[A-Za-z0-9._:/+-]+$' <<<"$lines" || true)"
if [ -n "$bad" ]; then
  echo "::error file=$PINS::not a plain KEY=literal line: $bad" >&2
  exit 1
fi
if [ -n "${GITHUB_ENV:-}" ]; then
  printf '%s\n' "$lines" >> "$GITHUB_ENV"
fi

echo "### proot pins (\`$PINS\`)"
echo
echo "| Pin | Value |"
echo "|---|---|"
while IFS='=' read -r key value; do
  printf '| `%s` | `%s` |\n' "$key" "$value"
done <<<"$lines"
echo
