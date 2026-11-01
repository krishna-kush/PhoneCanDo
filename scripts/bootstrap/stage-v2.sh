#!/bin/bash
# Stage a built v2 payload into AGP-safe module libs.
# The payload is a native bionic binary needing only system libs, so staging
# is two plain copies: the PIE payload (renamed *.so: AGP drops non-.so
# jniLibs files) plus the renderer lib.
# Service launcher must set:
#   OPENTUI_LIB_PATH=<libDir>/libopentui.so
#   OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true
# Usage: ./scripts/bootstrap/stage-v2.sh [build-out-dir] [module-libs-dir]
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"

WORK="${1:-$ROOT/work-v2/out}"
OUT="${2:-$ROOT/app/modules/phonecando-runner/android/src/main/libs/arm64-v8a}"
mkdir -p "$OUT"

for f in opencode2.bin libopentui.so; do
  [ -f "$WORK/$f" ] || { echo "STAGE FAIL: $WORK/$f missing (run scripts/bootstrap/build-engine-android.sh first)" >&2; exit 1; }
done

cp "$WORK/opencode2.bin" "$OUT/libopencode2.so"
cp "$WORK/libopentui.so" "$OUT/libopentui.so"
chmod 0755 "$OUT/libopencode2.so" "$OUT/libopentui.so"

echo "--- staged engine linkage guard (INTERP must be linker64, NEEDED system-only) ---"
readelf -d "$OUT/libopencode2.so" | grep -E 'NEEDED|INTERP'
NONSYSTEM="$(readelf -d "$OUT/libopencode2.so" | grep NEEDED | grep -v -E '\[(libc|libm|libdl)\.so\]' || true)"
if [ -n "$NONSYSTEM" ]; then
  echo "STAGE FAIL: engine needs non-system libs:" >&2
  echo "$NONSYSTEM" >&2
  exit 1
fi
echo "linkage OK: system-only"
ls -la "$OUT"
