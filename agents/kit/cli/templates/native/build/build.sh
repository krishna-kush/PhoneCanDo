#!/bin/bash
# Build the __ID__ payload for Android (bionic arm64).
# Output: <workdir>/out/<each payload.libs[].from in ../agent.json>.
# Usage: agents/native/__ID__/build/build.sh [workdir]
#        (or ./manage agent __ID__ build [workdir])
set -euo pipefail
cd "$(dirname "$0")"

WORK="${1:-${XDG_CACHE_HOME:-$HOME/.cache}/phonecando/__ID__}"
OUT="$WORK/out"
# shellcheck source=pins.env
. ./pins.env

: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME (Android NDK $NDK_VERSION)}"
mkdir -p "$OUT"

echo "TODO: build __ID__ for aarch64-linux-android$ANDROID_API into $OUT" >&2
exit 1
