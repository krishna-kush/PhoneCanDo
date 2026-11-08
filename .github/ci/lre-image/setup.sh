#!/usr/bin/env bash
# Lay out a Default env image the way the app does, for a Tier 1 run on a
# Linux host (CI: ubuntu-24.04-arm):
#
#   <scratch>/lib/   libproot.so, libproot-loader.so (from <proot-dir>) and
#                    our launcher libphonecando_launch.so (lre/launcher, gcc)
#   <scratch>/img/   PHONECANDO_IMAGE: rootfs/ (the image unpacked), home/,
#                    tmp/, run/{launch.conf,engine.env,proot-tmp,l2s,shm},
#                    shims/{bash,git,rg,python3,pip,sh} -> the launcher
#
# run/engine.env is what the engine gets (HOME, TMPDIR, SHELL, PATH with
# shims/ first, PHONECANDO_IMAGE); rootfs/etc/resolv.conf gets this host's
# DNS servers, as the app writes the network's.
#
# Usage: setup.sh <image.tar.xz> <proot-dir> <scratch>
#   <proot-dir>  lre/proot/build-glibc.sh's out-dir
#   <scratch>    created; must be empty or a previous setup.sh scratch
# Env: CC (default gcc); QEMU (optional, see launch-conf.sh)
set -euo pipefail
export LC_ALL=C

IMAGE="${1:?usage: setup.sh <image.tar.xz> <proot-dir> <scratch>}"
PROOT="$(cd "${2:?usage: setup.sh <image.tar.xz> <proot-dir> <scratch>}" && pwd -P)"
SCRATCH="${3:?usage: setup.sh <image.tar.xz> <proot-dir> <scratch>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"

mkdir -p "$SCRATCH"
SCRATCH="$(cd "$SCRATCH" && pwd -P)"
if [ -n "$(ls -A "$SCRATCH")" ] && [ ! -e "$SCRATCH/.lre-image-tier1" ]; then
  echo "setup: $SCRATCH is not empty and not a Tier 1 scratch" >&2
  exit 1
fi
# The rootfs has read-only dirs; make them writable before removing.
chmod -R u+w "$SCRATCH" 2> /dev/null || true
find "$SCRATCH" -mindepth 1 -delete
touch "$SCRATCH/.lre-image-tier1"

LIB="$SCRATCH/lib"
IMG="$SCRATCH/img"
mkdir -p "$LIB" "$IMG"/{rootfs,home,tmp,shims,run/proot-tmp,run/l2s,run/shm}
chmod 1777 "$IMG/tmp" "$IMG/run/shm"

install -m 0755 "$PROOT/libproot.so" "$PROOT/libproot-loader.so" "$LIB/"
"${CC:-gcc}" -std=c11 -O2 -Wall -Wextra -Werror -o "$LIB/libphonecando_launch.so" \
  "$REPO/lre/launcher/src/"{conf,plan,relay,die,standin,main}.c
for name in bash git rg python3 pip sh; do
  ln -s "$LIB/libphonecando_launch.so" "$IMG/shims/$name"
done

start=$SECONDS
tar --extract --xz --file="$IMAGE" --directory="$IMG/rootfs" --no-same-owner --preserve-permissions
unpack=$((SECONDS - start))
{
  echo "# Tier 1: this host's DNS servers, as the app writes the network's."
  grep '^nameserver' /etc/resolv.conf || echo 'nameserver 1.1.1.1'
} > "$IMG/rootfs/etc/resolv.conf"

bash "$HERE/launch-conf.sh" "$IMG" "$LIB"
cat > "$IMG/run/engine.env" <<EOF
HOME=$IMG/home
TMPDIR=$IMG/tmp
SHELL=$IMG/shims/bash
PATH=$IMG/shims:$PATH
PHONECANDO_IMAGE=$IMG
MAKEFLAGS=-j4
EOF
echo "set up $IMG (unpacked in ${unpack}s, $(du -sm "$IMG/rootfs" | cut -f1) MiB)"
