#!/bin/sh
# opencode's engine for the local-model check (.github/workflows/local-models.yml,
# .github/ci/local-models/leg.sh): upstream's own Linux build of our pinned
# tag (build/pins.env OPENCODE_TAG), npm's @opencode/cli with its platform
# package, linked in as <lib-dir>/liboc-engine.so, where one-shot.json runs
# it from, as the phone runs our Android build from the APK's lib dir.
# Runs in the check's machine (Node and npm on PATH, HOME /root).
# Usage: sh host-engine.sh <lib-dir>; prints the engine's version last.
set -eu

lib="${1:?usage: host-engine.sh <lib-dir>}"
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../build/pins.env
. "$here/../build/pins.env"
version="${OPENCODE_TAG#v}"
prefix=/opt/opencode

# The platform package is an optional dependency whose download npm skips
# quietly on a network error, and the postinstall then fails: try again.
tries=0
until npm install -g --no-fund --no-audit --prefix "$prefix" "@opencode/cli@$version"; do
  tries=$((tries + 1))
  [ "$tries" -lt 3 ] || exit 1
  echo "host-engine: npm install failed, again in $((5 * tries)) s" >&2
  sleep $((5 * tries))
done
pkg="$prefix/lib/node_modules/@opencode/cli"
# The launcher's own binary when its postinstall put one there; otherwise
# the platform package's.
engine=""
for f in "$pkg/bin/opencode.exe" "$pkg"/node_modules/@opencode/cli-linux-*/bin/opencode \
  "$prefix"/lib/node_modules/@opencode/cli-linux-*/bin/opencode; do
  if [ -f "$f" ] && head -c 4 "$f" | grep -q 'ELF'; then
    engine="$f"
    break
  fi
done
[ -n "$engine" ] || { echo "host-engine: no Linux opencode binary under $prefix" >&2; exit 1; }
mkdir -p "$lib"
ln -sf "$engine" "$lib/liboc-engine.so"
"$lib/liboc-engine.so" --version
