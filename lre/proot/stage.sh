#!/usr/bin/env bash
# Stage a verified Android proot build into the phonecando-linux Expo
# module's jniLibs, where AGP packages it into the APK's native-library dir
# (the only app path Android lets us exec from).
#
# Usage: lre/proot/stage.sh <dir> [libs-dir]
#   <dir>       build-android.sh's out-dir, after verify.sh passed (its
#               SHA256SUMS must be there and match), or the unzipped
#               proot-android-arm64 CI artifact
#   [libs-dir]  default app/modules/phonecando-linux/android/src/linux/libs/arm64-v8a
# Copies libproot.so and libproot-loader.so there, mode 0755, with their
# SHA256SUMS (the release preflight checks the staged libs against it) and
# INPUTS (ensure.sh compares it with this tree's to tell an up-to-date stage
# from an old one); AGP packages only *.so, so neither reaches the APK. The
# dir is gitignored: staged libs are never committed.
set -euo pipefail

SRC="$(cd "${1:?usage: stage.sh <dir> [libs-dir]}" && pwd)"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${2:-$ROOT/app/modules/phonecando-linux/android/src/linux/libs/arm64-v8a}"
FILES=(libproot.so libproot-loader.so)

if [ ! -f "$SRC/SHA256SUMS" ]; then
  echo "STAGE FAIL: $SRC/SHA256SUMS missing (run lre/proot/verify.sh $SRC first)" >&2
  exit 1
fi
for f in "${FILES[@]}"; do
  if ! grep -qE "^[0-9a-f]{64}  $f\$" "$SRC/SHA256SUMS"; then
    echo "STAGE FAIL: $f not listed in $SRC/SHA256SUMS" >&2
    exit 1
  fi
done
(cd "$SRC" && sha256sum --quiet -c SHA256SUMS) || {
  echo "STAGE FAIL: $SRC does not match its SHA256SUMS" >&2
  exit 1
}
if ! grep -qE '^[0-9a-f]{64}$' "$SRC/INPUTS" 2>/dev/null; then
  echo "STAGE FAIL: $SRC/INPUTS missing (build-android.sh writes it); rebuild" >&2
  exit 1
fi

# Our launcher runs proot with --status-fd (patches/0002): a proot without it
# fails every guest command, so an older build must never be staged.
if ! grep -aq -- '--status-fd' "$SRC/libproot.so"; then
  echo "STAGE FAIL: $SRC/libproot.so lacks --status-fd (patches/0002); stage a build that includes it" >&2
  exit 1
fi

mkdir -p "$DEST"
for f in "${FILES[@]}"; do
  install -m 0755 "$SRC/$f" "$DEST/$f"
done
install -m 0644 "$SRC/SHA256SUMS" "$DEST/SHA256SUMS"
install -m 0644 "$SRC/INPUTS" "$DEST/INPUTS"
echo "staged into $DEST:"
ls -l "$DEST"
