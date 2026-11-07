#!/usr/bin/env bash
# Build termux/proot and its loader for this Linux host (glibc, native
# compiler, any arch proot supports): the same pinned sources, the same
# unbundled-loader layout and the same file names as build-android.sh, so CI
# can run distro images under it on plain Linux (proot.yml, ubuntu-24.04-arm).
#
# Usage: lre/proot/build-glibc.sh <workdir> <out-dir>
#   <workdir>  downloads cache (<workdir>/downloads) and the build trees
#              (<workdir>/glibc-<arch>, rebuilt every run)
#   <out-dir>  gets libproot.so and libproot-loader.so (stripped, 0755)
# Env (optional): CC, AR, NM, STRIP (default cc, ar, nm, strip).
#
# Run it like the app does:
#   PROOT_LOADER=<out-dir>/libproot-loader.so PROOT_TMP_DIR=<dir> \
#     <out-dir>/libproot.so -0 -r <rootfs> -w / /bin/sh
set -euo pipefail
export LC_ALL=C TZ=UTC
umask 022

WORK="${1:?usage: build-glibc.sh <workdir> <out-dir>}"
OUT="${2:?usage: build-glibc.sh <workdir> <out-dir>}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=steps/sources.sh
. "$HERE/steps/sources.sh"
# shellcheck source=steps/talloc.sh
. "$HERE/steps/talloc.sh"
# shellcheck source=steps/proot.sh
. "$HERE/steps/proot.sh"
pins_load

case "$WORK" in
  *[[:space:]]*) echo "build FAIL: make cannot cope with spaces in the workdir path" >&2; exit 1 ;;
esac
mkdir -p "$WORK" "$OUT"
WORK="$(cd "$WORK" && pwd)"
OUT="$(cd "$OUT" && pwd)"
ROOT="$WORK/glibc-$(uname -m)"

export CC="${CC:-cc}" AR="${AR:-ar}" NM="${NM:-nm}" STRIP="${STRIP:-strip}"
# Distro compiler defaults otherwise (this build is a test tool, not shipped).
export CFLAGS_TARGET="-ffile-prefix-map=$ROOT=."
export CPPFLAGS_TARGET="-DARG_MAX=131072 -DVERSION=\\\"$PROOT_VERSION\\\""
export LDFLAGS_TARGET=""
# Distro gcc may default to -fstack-protector; the loader is freestanding.
export LOADER_CFLAGS_TARGET="-fno-stack-protector"
export LOADER_LDFLAGS_TARGET=""
# Upstream probes the linker for --rosegment (meant for NDK lld). GNU ld
# accepts it too in newer binutils (2.47 here) and then puts .rodata in its
# own segment at the default base while -Ttext moves .text to LOADER_ADDRESS,
# so the loader's PC-relative jump-table relocations overflow. Keep GNU ld's
# classic layout (.rodata right after .text).
export MAKE_VARS_TARGET="ROSEGMENT="

sources_fetch "$WORK"
rm -rf "$ROOT"
unpack_fresh "$TALLOC_TARBALL" "$ROOT/talloc-src"
unpack_fresh "$PROOT_TARBALL" "$ROOT/proot"
patches_apply "$ROOT/proot"

talloc_build "$ROOT/talloc-src" "$ROOT/talloc"
proot_build "$ROOT/proot" "$ROOT/talloc" "$OUT"

echo "--- built (glibc $(uname -m), proot $PROOT_VERSION @ ${PROOT_COMMIT:0:12}, talloc $TALLOC_VERSION) ---"
(cd "$OUT" && ls -l libproot.so libproot-loader.so && sha256sum libproot.so libproot-loader.so)
