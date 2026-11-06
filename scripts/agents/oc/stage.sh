#!/bin/bash
# Stage a built v2 payload into AGP-safe module libs.
# The payload is a native bionic binary needing only system libs, so staging
# is two plain copies: the PIE payload (renamed *.so: AGP drops non-.so
# jniLibs files) plus the renderer lib.
# Service launcher must set:
#   OPENTUI_LIB_PATH=<libDir>/liboc-opentui.so
#   OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true
# Usage: ./scripts/agents/oc/stage.sh [build-out-dir] [module-libs-dir]
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../../.. && pwd)"

WORK="${1:-$ROOT/work-v2/out}"
OUT="${2:-$ROOT/app/modules/phonecando-runner/android/src/main/libs/arm64-v8a}"
mkdir -p "$OUT"

for f in opencode2.bin libopentui.so; do
  [ -f "$WORK/$f" ] || { echo "STAGE FAIL: $WORK/$f missing (run scripts/agents/oc/build.sh first)" >&2; exit 1; }
done

cp "$WORK/opencode2.bin" "$OUT/liboc-engine.so"
cp "$WORK/libopentui.so" "$OUT/liboc-opentui.so"
chmod 0755 "$OUT/liboc-engine.so" "$OUT/liboc-opentui.so"

echo "--- staged engine linkage guard (INTERP must be linker64, NEEDED system-only) ---"
readelf -d "$OUT/liboc-engine.so" | grep -E 'NEEDED|INTERP'
NONSYSTEM="$(readelf -d "$OUT/liboc-engine.so" | grep NEEDED | grep -v -E '\[(libc|libm|libdl)\.so\]' || true)"
if [ -n "$NONSYSTEM" ]; then
  echo "STAGE FAIL: engine needs non-system libs:" >&2
  echo "$NONSYSTEM" >&2
  exit 1
fi
echo "linkage OK: system-only"
ls -la "$OUT"
