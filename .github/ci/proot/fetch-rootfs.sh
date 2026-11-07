#!/usr/bin/env bash
# Fetch the pinned Alpine minirootfs for this runner's arch (pins.env
# ALPINE_<ARCH>_URL/_SHA256), sha256-verified with the same fetch code the
# proot builds use. Only aarch64 is pinned: proot.yml's smoke test runs on
# ubuntu-24.04-arm.
#
# Usage: bash .github/ci/proot/fetch-rootfs.sh <dest-file>
set -euo pipefail

DEST="${1:?usage: fetch-rootfs.sh <dest-file>}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
# shellcheck source=../../../lre/proot/steps/sources.sh
. "$ROOT/lre/proot/steps/sources.sh"
pins_load

case "$(uname -m)" in
  aarch64 | arm64) url="${ALPINE_AARCH64_URL:?}" sha="${ALPINE_AARCH64_SHA256:?}" ;;
  *) echo "::error::no Alpine minirootfs pinned for $(uname -m) (pins.env)"; exit 1 ;;
esac
fetch_verified "$DEST" "$sha" "$url"
echo "Alpine $ALPINE_VERSION minirootfs ($(uname -m)): \`$(basename "$url")\`, sha256 \`$sha\`"
