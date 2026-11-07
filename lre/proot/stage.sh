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
# SHA256SUMS (the release preflight checks the staged libs against it; AGP
# packages only *.so, so it never reaches the APK). The dir is gitignored:
# staged libs are never committed.
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

mkdir -p "$DEST"
for f in "${FILES[@]}"; do
  install -m 0755 "$SRC/$f" "$DEST/$f"
done
install -m 0644 "$SRC/SHA256SUMS" "$DEST/SHA256SUMS"
echo "staged into $DEST:"
ls -l "$DEST"
