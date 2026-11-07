#!/usr/bin/env bash
# Stage a Default env image into the phonecando-linux Expo module's assets
# (full and lite only; both dirs are gitignored), where the APK carries it
# stored, not deflated:
#
#   default-image/rootfs.tar.xz   the image, byte for byte
#   default-image/image.json      what it is: version, sha256, size, release,
#                                 debian digest, snapshot
#
# Locked (default): the image lock.json names, from fetch.sh, into
# src/linux/assets/ (every full and lite build, release ones included).
# --local: an image we built here (build.sh, ./manage image build), unlocked,
# into src/linux/dev-assets/: build.gradle puts that dir on the fullDebug and
# liteDebug variants only, so no release APK can carry it, and in a debug
# build it wins over a locked one. Its image.json says "local": true and has
# no release. Remove it with `rm -r <dev-assets>/default-image`.
#
# Usage: lre/images/default/lock/stage.sh [src-dir] [assets-dir]
#        lre/images/default/lock/stage.sh --local [out-dir] [dev-assets-dir]
#   [src-dir]         where fetch.sh put the asset, default dist/images
#   [assets-dir]      default app/modules/phonecando-linux/android/src/linux/assets
#   [out-dir]         build.sh's out-dir, default dist/images/local
#   [dev-assets-dir]  default app/modules/phonecando-linux/android/src/linux/dev-assets
# The file must match lock.json (locked) or its build manifest (--local),
# sha256 and size, or nothing is staged.
set -euo pipefail
export LC_ALL=C

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
LOCK="$HERE/../lock.json"
MODULE="$ROOT/app/modules/phonecando-linux/android/src/linux"

fail() { echo "STAGE FAIL: $*" >&2; exit 1; }
matches() { [ "$(stat -L -c %s "$1")" = "$3" ] && [ "$(sha256sum < "$1" | cut -d' ' -f1)" = "$2" ]; }

if [ "${1-}" = --local ]; then
  SRC="${2:-$ROOT/dist/images/local}"
  ASSETS="${3:-$MODULE/dev-assets}"
  mapfile -t found < <(find "$SRC" -maxdepth 1 -name 'phonecando-linux-default-*.json')
  [ "${#found[@]}" = 1 ] || fail "want one build manifest in $SRC, found ${#found[@]} (./manage image build)"
  manifest="${found[0]}"
  [ "$(jq -r .arch "$manifest")" = arm64 ] || fail "$manifest is not an arm64 image"
  asset="$(jq -r .asset "$manifest")" sha256="$(jq -r .sha256 "$manifest")" size="$(jq -r .size "$manifest")"
  info="$(jq '{version, sha256, size, release: null, debian_digest: .debian.digest,
               snapshot: .debian.snapshot, local: true}' "$manifest")"
  what="its build manifest"
else
  SRC="${1:-$ROOT/dist/images}"
  ASSETS="${2:-$MODULE/assets}"
  bash "$HERE/check.sh" --locked
  asset="$(jq -r .asset "$LOCK")" sha256="$(jq -r .sha256 "$LOCK")" size="$(jq -r .size "$LOCK")"
  info="$(jq '{version, sha256, size, release, debian_digest, snapshot}' "$LOCK")"
  what="lock.json"
fi

file="$SRC/$asset"
[ -f "$file" ] || fail "$file missing (./manage image fetch, or build for --local)"
matches "$file" "$sha256" "$size" || fail "$file is not the image $what names (sha256 $sha256, $size bytes)"

dir="$ASSETS/default-image"
mkdir -p "$dir"
install -m 0644 "$file" "$dir/rootfs.tar.xz.part"
mv "$dir/rootfs.tar.xz.part" "$dir/rootfs.tar.xz"
printf '%s\n' "$info" > "$dir/image.json"
echo "staged into $dir:"
ls -l "$dir"
if [ "${1-}" != --local ] && [ -e "$MODULE/dev-assets/default-image" ]; then
  echo "note: debug builds still use the local image in $MODULE/dev-assets/default-image"
fi
