#!/usr/bin/env bash
# Stage a verified Android llama-server build into the phonecando-models
# Expo module's jniLibs, where AGP packages it into the APK's
# native-library dir (the only app path Android lets us exec from).
#
# Usage: lme/llamacpp/stage.sh <dir> [libs-dir]
#   <dir>       build.sh's out-dir, after verify.sh passed (its SHA256SUMS
#               must be there and match), or the unzipped
#               llamacpp-android-arm64 CI artifact
#   [libs-dir]  default app/modules/phonecando-models/android/src/main/jniLibs/arm64-v8a
# Copies libllama-server.so there, mode 0755, with its SHA256SUMS and
# INPUTS (the digest of the pins and build script it was built from); AGP
# packages only *.so, so neither reaches the APK. Staged libs are never
# committed.
set -euo pipefail

SRC="$(cd "${1:?usage: stage.sh <dir> [libs-dir]}" && pwd)"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${2:-$ROOT/app/modules/phonecando-models/android/src/main/jniLibs/arm64-v8a}"
LIB=libllama-server.so

if [ ! -f "$SRC/SHA256SUMS" ]; then
  echo "STAGE FAIL: $SRC/SHA256SUMS missing (run lme/llamacpp/verify.sh $SRC first)" >&2
  exit 1
fi
if ! grep -qE "^[0-9a-f]{64}  $LIB\$" "$SRC/SHA256SUMS"; then
  echo "STAGE FAIL: $LIB not listed in $SRC/SHA256SUMS" >&2
  exit 1
fi
(cd "$SRC" && sha256sum --quiet -c SHA256SUMS) || {
  echo "STAGE FAIL: $SRC does not match its SHA256SUMS" >&2
  exit 1
}
if ! grep -qE '^[0-9a-f]{64}$' "$SRC/INPUTS" 2>/dev/null; then
  echo "STAGE FAIL: $SRC/INPUTS missing (build.sh writes it); rebuild" >&2
  exit 1
fi

mkdir -p "$DEST"
install -m 0755 "$SRC/$LIB" "$DEST/$LIB"
install -m 0644 "$SRC/SHA256SUMS" "$DEST/SHA256SUMS"
install -m 0644 "$SRC/INPUTS" "$DEST/INPUTS"
echo "staged into $DEST:"
ls -l "$DEST"
