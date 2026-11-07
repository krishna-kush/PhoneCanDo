#!/usr/bin/env bash
# Build termux/proot and its loader for Android arm64 (bionic, API and NDK
# from pins.env), loader unbundled, talloc linked statically.
#
# Usage: ANDROID_NDK_HOME=<ndk r28c> lre/proot/build-android.sh <workdir> <out-dir>
#   <workdir>  downloads cache (<workdir>/downloads, sha256-verified, reused)
#              and the build trees (<workdir>/android, rebuilt every run)
#   <out-dir>  gets libproot.so and libproot-loader.so (stripped, 0755)
#
# Runtime contract (the app's launcher): proot needs
#   PROOT_LOADER=<nativeLibDir>/libproot-loader.so
#   PROOT_TMP_DIR=<a writable app dir>
# With PROOT_LOADER unset it tries /PROOT_LOADER-unset/loader and the guest
# never starts. Check the outputs with lre/proot/verify.sh <out-dir>.
set -euo pipefail
export LC_ALL=C TZ=UTC
umask 022

WORK="${1:?usage: build-android.sh <workdir> <out-dir>}"
OUT="${2:?usage: build-android.sh <workdir> <out-dir>}"
: "${ANDROID_NDK_HOME:?ANDROID_NDK_HOME must point at the Android NDK (pins.env NDK_VERSION)}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=steps/sources.sh
. "$HERE/steps/sources.sh"
# shellcheck source=steps/talloc.sh
. "$HERE/steps/talloc.sh"
# shellcheck source=steps/proot.sh
. "$HERE/steps/proot.sh"
pins_load

# Same NDK, same bytes: a different clang is a different build.
ndk_release="$(sed -n 's/^Pkg\.ReleaseName *= *//p' "$ANDROID_NDK_HOME/source.properties" 2>/dev/null || true)"
if [ "$ndk_release" != "$NDK_VERSION" ]; then
  echo "build FAIL: $ANDROID_NDK_HOME is NDK '${ndk_release:-unknown}', pins.env wants $NDK_VERSION" >&2
  exit 1
fi
case "$(uname -s)" in
  Linux) host=linux-x86_64 ;;
  Darwin) host=darwin-x86_64 ;;
  *) echo "build FAIL: no NDK prebuilt toolchain for $(uname -s)" >&2; exit 1 ;;
esac
TC="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/$host/bin"
[ -x "$TC/clang" ] || { echo "build FAIL: $TC/clang not found" >&2; exit 1; }
case "$TC$WORK" in
  *[[:space:]]*) echo "build FAIL: make cannot cope with spaces in the NDK or workdir path" >&2; exit 1 ;;
esac

mkdir -p "$WORK" "$OUT"
WORK="$(cd "$WORK" && pwd)"
OUT="$(cd "$OUT" && pwd)"
ROOT="$WORK/android"

export CC="$TC/clang --target=aarch64-linux-android$ANDROID_API"
export AR="$TC/llvm-ar" NM="$TC/llvm-nm" STRIP="$TC/llvm-strip"
# Build paths never reach the binaries (-ffile-prefix-map). Stack protector
# as in a Termux release build, plus fortify; NDK clang already defaults to
# PIE, -z now/relro and 16 KB max-page-size, the last made explicit here for
# both files.
export CFLAGS_TARGET="-ffile-prefix-map=$ROOT=. -fstack-protector-strong -D_FORTIFY_SOURCE=2"
# termux-packages' proot CPPFLAGS (packages/proot/build.sh).
export CPPFLAGS_TARGET="-DARG_MAX=131072 -DVERSION=\\\"$PROOT_VERSION\\\""
export LDFLAGS_TARGET="-Wl,-z,max-page-size=16384"
# The loader runs before any TLS exists: no canary, no fortify wrappers.
export LOADER_CFLAGS_TARGET="-fno-stack-protector -U_FORTIFY_SOURCE"
export LOADER_LDFLAGS_TARGET="-Wl,-z,max-page-size=16384"

sources_fetch "$WORK"
rm -rf "$ROOT"
unpack_fresh "$TALLOC_TARBALL" "$ROOT/talloc-src"
unpack_fresh "$PROOT_TARBALL" "$ROOT/proot"
patches_apply "$ROOT/proot"

talloc_build "$ROOT/talloc-src" "$ROOT/talloc"
proot_build "$ROOT/proot" "$ROOT/talloc" "$OUT"

echo "--- built (android arm64, api-$ANDROID_API, proot $PROOT_VERSION @ ${PROOT_COMMIT:0:12}, talloc $TALLOC_VERSION) ---"
(cd "$OUT" && ls -l libproot.so libproot-loader.so && sha256sum libproot.so libproot-loader.so)
