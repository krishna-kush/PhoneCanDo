#!/usr/bin/env bash
# Smoke test for a host (glibc) proot build from lre/proot/build-glibc.sh,
# run the way the app runs proot: loader unbundled (PROOT_LOADER points at
# libproot-loader.so, never extracted to tmp) and PROOT_TMP_DIR set.
#
#   1. `libproot.so -V` names pins.env's PROOT_VERSION
#   2. -0 -r <rootfs> -w / /bin/sh -c 'echo ok; id -u'   prints ok, then 0
#   3. the same with -L --link2symlink --sysvipc --kernel-release=… (the
#      flags the app passes: lre/image's LaunchConf.PROOT_FLAGS; keep in
#      step) accepted, same output
#   4. PROOT_LOADER unset: the guest must NOT start (no bundled fallback)
#   5. nothing executable was written to PROOT_TMP_DIR
#
# Usage: smoke.sh <proot-dir> <rootfs.tar.gz> <scratch-dir>
#   <rootfs.tar.gz> is a minirootfs for this host's arch (CI: pins.env's
#   Alpine aarch64 on ubuntu-24.04-arm); <scratch-dir> is emptied and used
#   for the rootfs and PROOT_TMP_DIR.
#   Markdown table on stdout, exit 1 on any FAIL.
set -euo pipefail
export LC_ALL=C

DIR="$(cd "${1:?usage: smoke.sh <proot-dir> <rootfs.tar.gz> <scratch-dir>}" && pwd)"
TARBALL="${2:?usage: smoke.sh <proot-dir> <rootfs.tar.gz> <scratch-dir>}"
SCRATCH="${3:?usage: smoke.sh <proot-dir> <rootfs.tar.gz> <scratch-dir>}"
PINS="$(cd "$(dirname "$0")/../../.." && pwd)/lre/proot/pins.env"
PROOT_VERSION="$(sed -n 's/^PROOT_VERSION=//p' "$PINS")"

PROOT="$DIR/libproot.so"
LOADER="$DIR/libproot-loader.so"
ROOTFS="$SCRATCH/rootfs"
TMPD="$SCRATCH/tmp"
rm -rf "$ROOTFS" "$TMPD"
mkdir -p "$ROOTFS" "$TMPD"
tar -xzf "$TARBALL" -C "$ROOTFS" --no-same-owner
export PROOT_TMP_DIR="$TMPD"
unset PROOT_LOADER PROOT_LOADER_32

fail=0
logs=""
row() { printf '| %s | %s | %s |\n' "$1" "$2" "$3"; }
ok() { row "$1" "$2" OK; }
bad() { row "$1" "$2" "**FAIL**"; fail=1; }
oneline() { tr '\n' ' ' <<<"$1" | sed 's/ *$//; s/|/\\|/g'; }
keep_log() { logs+=$'\n'"<details><summary>$1</summary>"$'\n\n```\n'"$2"$'\n```\n</details>\n'; }

echo "### proot smoke test ($(uname -m), unbundled loader)"
echo
echo "| Check | Output | |"
echo "|---|---|---|"

ver="$("$PROOT" -V 2>&1 || true)"
if grep -qF "$PROOT_VERSION" <<<"$ver"; then ok "version" "\`$PROOT_VERSION\`"
else bad "version" "want \`$PROOT_VERSION\`"; keep_log "proot -V" "$ver"; fi

guest=(-r "$ROOTFS" -w / /bin/sh -c 'echo ok; id -u')
want=$'ok\n0'

if out="$(PROOT_LOADER="$LOADER" "$PROOT" -0 "${guest[@]}" 2>&1)"; then rc=0; else rc=$?; fi
if [ "$rc" -eq 0 ] && [ "$out" = "$want" ]; then ok "\`-0\`, echo ok; id -u" "\`$(oneline "$out")\`"
else bad "\`-0\`, echo ok; id -u" "exit $rc"; keep_log "-0 run (exit $rc)" "$out"; fi

if out="$(PROOT_LOADER="$LOADER" "$PROOT" -0 -L --link2symlink --sysvipc --kernel-release=6.1.0-phonecando "${guest[@]}" 2>&1)"; then
  rc=0
else
  rc=$?
fi
if [ "$rc" -eq 0 ] && [ "$out" = "$want" ]; then
  ok "\`-0 -L --link2symlink --sysvipc --kernel-release\`" "\`$(oneline "$out")\`"
else
  bad "\`-0 -L --link2symlink --sysvipc --kernel-release\`" "exit $rc"
  keep_log "extension flags run (exit $rc)" "$out"
fi

if out="$("$PROOT" -0 "${guest[@]}" 2>&1)"; then rc=0; else rc=$?; fi
if [ "$rc" -ne 0 ] && ! grep -qx ok <<<"$out"; then ok "PROOT_LOADER unset: guest must not start" "exit $rc"
else bad "PROOT_LOADER unset: guest must not start" "exit $rc, guest ran"; keep_log "no-loader run (exit $rc)" "$out"; fi

leftover="$(find "$TMPD" -type f -perm -u+x -print)"
if [ -z "$leftover" ]; then ok "no executable written to PROOT_TMP_DIR" "-"
else bad "no executable written to PROOT_TMP_DIR" "$(oneline "$leftover")"; fi

echo
if [ -n "$logs" ]; then printf '%s\n' "$logs"; fi
exit "$fail"
