#!/usr/bin/env bash
# The inputs of one Default env build, and the version they name. Prints
# KEY=value lines (values are literal, safe to append to $GITHUB_ENV):
#
#   DEBIAN_TAG DEBIAN_DIGEST SNAPSHOT SOURCE_DATE_EPOCH RECIPE_SHA256 VERSION
#
# VERSION = <snapshot date>-<8 hex of sha256(recipe, digest, snapshot)>, so
# the same inputs always name the same version and any change names a new
# one (the release tag is linux-image-<VERSION>).
#
# Usage: lre/images/default/inputs.sh [--fresh]
#   default   pins.env; DEBIAN_DIGEST / SNAPSHOT in the environment override
#             it (rebuild a published image from its manifest)
#   --fresh   the newest debian:<DEBIAN_TAG> manifest for PLATFORM and the
#             snapshot of today 00:00 UTC (needs docker buildx and jq)
# Env: PLATFORM (default linux/arm64; only --fresh reads it)
set -euo pipefail
export LC_ALL=C

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fresh=false
case "${1-}" in
  "") ;;
  --fresh) fresh=true ;;
  *) echo "usage: inputs.sh [--fresh]" >&2; exit 2 ;;
esac

env_digest="${DEBIAN_DIGEST-}" env_snapshot="${SNAPSHOT-}"
# shellcheck source=pins.env
. "$HERE/pins.env"
DEBIAN_DIGEST="${env_digest:-$DEBIAN_DIGEST}"
SNAPSHOT="${env_snapshot:-$SNAPSHOT}"

if $fresh; then
  platform="${PLATFORM:-linux/arm64}"
  arch="${platform#linux/}"
  DEBIAN_DIGEST="$(docker buildx imagetools inspect --raw "debian:$DEBIAN_TAG" \
    | jq -r --arg a "$arch" '[.manifests[] | select(.platform.os == "linux" and .platform.architecture == $a)][0].digest // empty')"
  SNAPSHOT="$(date -u +%Y%m%dT000000Z)"
fi

if [[ ! "$DEBIAN_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "inputs: bad DEBIAN_DIGEST '$DEBIAN_DIGEST'" >&2
  exit 1
fi
if [[ ! "$SNAPSHOT" =~ ^([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})Z$ ]]; then
  echo "inputs: bad SNAPSHOT '$SNAPSHOT' (want YYYYMMDDTHHMMSSZ)" >&2
  exit 1
fi
m=("${BASH_REMATCH[@]}")
sde="$(date -u -d "${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z" +%s)"

# Every file under recipe/ decides bytes of the image; names and contents
# (not modes) go into the hash.
recipe="$(cd "$HERE/recipe" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
id="$(printf '%s\n' "$recipe" "$DEBIAN_DIGEST" "$SNAPSHOT" | sha256sum | cut -c1-8)"

cat <<EOF
DEBIAN_TAG=$DEBIAN_TAG
DEBIAN_DIGEST=$DEBIAN_DIGEST
SNAPSHOT=$SNAPSHOT
SOURCE_DATE_EPOCH=$sde
RECIPE_SHA256=$recipe
VERSION=${SNAPSHOT:0:8}-$id
EOF
