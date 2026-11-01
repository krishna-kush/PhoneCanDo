#!/bin/bash
# Build the on-device opencode payload from upstream anomalyco/opencode.
# Output: <workdir>/out/opencode2.bin (bionic aarch64) + libopentui.so.
# The web UI is embedded (opencode-web-ui.gen.ts) and the pair API comes with
# the newer upstream pin. The android compile target (absent upstream) is
# added via scripts/bootstrap/patches/build-android-target.patch.
#
# Toolchain (all overridable, none machine-local):
#   ANDROID_NDK_HOME  Android NDK r28 (downloaded once, cached in workdir)
#   ZIG_BIN           zig 0.16.0 binary
#   OPENCODE_WORKTREE upstream checkout (must be at a pair-era tag, e.g. v2.0.26)
#   WORK_DIR          scratch (bionic includes, dist, packages)
# Usage: ./scripts/bootstrap/build-engine-android.sh [workdir]
set -euo pipefail
cd "$(dirname "$0")"
PHONECANDO_ROOT="$(cd ../.. && pwd)"

WORK="${1:-${XDG_CACHE_HOME:-$HOME/.cache}/opencode/v2build}"
DIST="$WORK/dist"
OUT="$WORK/out"
PATCH="$PHONECANDO_ROOT/scripts/bootstrap/patches/build-android-target.patch"

export BUN_VERSION="${BUN_VERSION:-1.4.2}"
export BUN_COMPILE_RELEASE="bun-v${BUN_VERSION}"
export OPENCODE_VERSION="${OPENCODE_VERSION:-2.0.26-android-phonecando.1}"
export OPENCODE_CHANNEL="${OPENCODE_CHANNEL:-android-phonecando}"
export ANDROID_API="${ANDROID_API:-29}"
export OPENTUI_VERSION="${OPENTUI_VERSION:-0.5.17}"
export OPENCODE_WORKTREE="${OPENCODE_WORKTREE:-$WORK/oc-v2}"
export WORK_DIR="$WORK/work"
export DIST_DIR="$DIST"
export NDK_TOOLCHAIN="${ANDROID_NDK_HOME}/toolchains/llvm/prebuilt/linux-x86_64"
export NDK_SYSROOT="${NDK_TOOLCHAIN}/sysroot"
export OPENTUI_LIB="${OPENTUI_LIB:-$OUT/libopentui.so}"

: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME}"
: "${ZIG_BIN:?set ZIG_BIN}"
[ -x "$ZIG_BIN" ] || { echo "ZIG_BIN not executable: $ZIG_BIN" >&2; exit 1; }
[ -d "$OPENCODE_WORKTREE/packages/cli" ] || { echo "no upstream checkout at $OPENCODE_WORKTREE" >&2; exit 1; }

mkdir -p "$OUT" "$WORK_DIR"

# 1. Android compile target (missing upstream) + graceful no-pty on android.
if git -C "$OPENCODE_WORKTREE" apply --check "$PATCH" 2>/dev/null; then
  git -C "$OPENCODE_WORKTREE" apply "$PATCH"
  echo "android target patch applied"
else
  echo "android target patch already applied — continuing"
fi

# 2. Renderer lib (zig + NDK sysroot).
# (mirrors the upstream opentui build; kept inline so paths stay ours)
OPENTUI_SRC="${OPENTUI_SRC:-$WORK/opentui-$OPENTUI_VERSION}"
if [ ! -d "$OPENTUI_SRC/.git" ]; then
  git clone --depth 1 --branch "v${OPENTUI_VERSION}" https://github.com/anomalyco/opentui.git "$OPENTUI_SRC"
fi
# Our build.zig fixes (bionic includes for translate-c, NDK lib dir for the
# link, no libpthread on bionic). Idempotent like the cli patch above.
OPENTUI_PATCH="$PHONECANDO_ROOT/scripts/bootstrap/patches/opentui-android-build.patch"
if git -C "$OPENTUI_SRC" apply --check "$OPENTUI_PATCH" 2>/dev/null; then
  git -C "$OPENTUI_SRC" apply "$OPENTUI_PATCH"
  echo "opentui android patch applied"
else
  echo "opentui android patch already applied — continuing"
fi
BIONIC_INC="$WORK_DIR/bionic-include"
ZIG_LIBC="$WORK_DIR/bionic-libc.txt"
rm -rf "$BIONIC_INC" && mkdir -p "$BIONIC_INC/__opentui"
cp -a "$NDK_SYSROOT/usr/include/." "$BIONIC_INC/"
cp -a "$NDK_SYSROOT/usr/include/aarch64-linux-android/." "$BIONIC_INC/"
# zig translate-c chokes on clang nullability in array bounds (NDK r28c
# sys/time.h and 130+ other headers); annotations are ABI-neutral, strip them
# from OUR copy (same spirit as the __opentui shims below).
grep -rl '_Nullable\|_Nonnull\|_Null_unspecified' "$BIONIC_INC" | xargs sed -i 's/\b_Nullable\b//g; s/\b_Nonnull\b//g; s/\b_Null_unspecified\b//g'
printf '#define _Nullable\n#define _Nonnull\n#include "../miniaudio.h"\n' > "$BIONIC_INC/__opentui/miniaudio_shimmed.h"
printf '#define _Nullable\n#define _Nonnull\n#include "../yoga/yoga/Yoga.h"\n' > "$BIONIC_INC/__opentui/Yoga_shimmed.h"
cat > "$ZIG_LIBC" <<EOF
include_dir=$BIONIC_INC
sys_include_dir=$BIONIC_INC
crt_dir=$NDK_SYSROOT/usr/lib/aarch64-linux-android/$ANDROID_API
msvc_lib_dir=
kernel32_lib_dir=
gcc_dir=
EOF
export ANDROID_NDK_HOME BIONIC_SYSROOT_INC="$BIONIC_INC" ZIG_LIBC ANDROID_API
# NOTE: --libc covers includes/CRT, but zig 0.16 only searches -L paths for
# -ldl/-lm: the NDK lib dir reaches the link via build.zig (see patch), which
# reads ANDROID_NDK_HOME/ANDROID_API from the env exported above.
(cd "$OPENTUI_SRC/packages/native" && sh scripts/prepare-zig-deps.sh && "$ZIG_BIN" build -Dlibrary-target=aarch64-linux-android -Doptimize=ReleaseSafe --libc "$ZIG_LIBC")
cp "$OPENTUI_SRC/packages/native/lib/aarch64-linux-android/libopentui.so" "$OPENTUI_LIB"
echo "libopentui.so ready: $OPENTUI_LIB"

# 3. Engine: deps + embedded web UI + android compile (NO --skip-web-ui).
(cd "$OPENCODE_WORKTREE" && bun install)
# bun re-sorts a dependency line in packages/cli/package.json on every
# install — revert the noise so the tree matches the tag plus our patch.
git -C "$OPENCODE_WORKTREE" checkout -- packages/cli/package.json 2>/dev/null || true
# 3.5 @opentui/core ≥0.5.15 dropped OPENTUI_LIB_PATH and rejects android
# targets outright ("Unsupported OpenTUI Node asset target: android-arm64",
# which the TUI wraps as "failed to initialize opentui render library").
# Restore the direct-path override our service launcher sets. Chunk filename
# is content-hashed, so glob it; idempotent across reruns.
OPENTUI_CHUNK="$(echo "$OPENCODE_WORKTREE"/packages/cli/node_modules/@opentui/core/chunk-bun-*.js | cut -d' ' -f1)"
python3 - "$OPENTUI_CHUNK" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
if "OPENTUI_LIB_PATH) return" in s:
    print("opentui js already patched — skipping")
else:
    anchor = "async function resolveNativeLibraryPath() {"
    assert anchor in s, "resolveNativeLibraryPath anchor missing"
    ins = anchor + "\n  if (process.env.OPENTUI_LIB_PATH) return process.env.OPENTUI_LIB_PATH;"
    open(p, "w").write(s.replace(anchor, ins, 1))
    print("opentui js patched:", p)
EOF
(cd "$OPENCODE_WORKTREE/packages/cli" && bun run script/build.ts \
  --target=opencode-linux-arm64-android \
  --outdir="$DIST/cli")
cp "$DIST/cli/cli-linux-arm64-android/bin/opencode" "$OUT/opencode2.bin"
chmod 755 "$OUT/opencode2.bin"
echo "payload ready: $OUT/opencode2.bin"
ls -la "$OUT"
