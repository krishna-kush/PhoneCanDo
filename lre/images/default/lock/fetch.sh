#!/usr/bin/env bash
# Download the locked Default env image (lock.json) from its GitHub release
# into dist/images/, sha256- and size-verified. A verified copy already
# there is kept. Read-only: plain HTTPS download, no GitHub login needed.
#
# Usage: lre/images/default/lock/fetch.sh [dest-dir]
#   [dest-dir]  default dist/images (repo root); gets <asset> from lock.json
# Prints the path. Exit 3 when nothing is locked yet (check.sh --locked).
set -euo pipefail
export LC_ALL=C

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
LOCK="$HERE/../lock.json"
DEST="${1:-$ROOT/dist/images}"

bash "$HERE/check.sh" --locked
asset="$(jq -r .asset "$LOCK")" url="$(jq -r .url "$LOCK")"
sha256="$(jq -r .sha256 "$LOCK")" size="$(jq -r .size "$LOCK")"

matches() { [ -f "$1" ] && [ "$(stat -L -c %s "$1")" = "$size" ] && [ "$(sha256sum < "$1" | cut -d' ' -f1)" = "$sha256" ]; }

mkdir -p "$DEST"
file="$DEST/$asset"
if matches "$file"; then
  echo "cached: $file (sha256 ok)" >&2
else
  rm -f "$file.part"
  echo "fetch: $url" >&2
  if ! curl -fL --retry 3 --retry-delay 5 --connect-timeout 30 -o "$file.part" "$url"; then
    rm -f "$file.part"
    echo "fetch FAIL: cannot download $url" >&2
    exit 1
  fi
  if ! matches "$file.part"; then
    rm -f "$file.part"
    echo "fetch FAIL: $asset from its release is not the locked sha256 $sha256 / $size bytes" >&2
    exit 1
  fi
  mv "$file.part" "$file"
fi
echo "$file"
