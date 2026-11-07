#!/bin/bash
# Pack a baked rootfs into the deterministic image tarball: runs as root
# INSIDE a container of the baked image (build.sh starts it, so tar and xz
# are the pinned image's own and every rebuild uses the same tools).
#
#   /in/raw.tar   `docker export` of the bake container
#   /out/         gets <asset> (.tar.xz), <asset>.sha256, packages.tsv,
#                 sources.tsv, pack.env (sizes for the manifest), all owned
#                 by HOST_UID:HOST_GID
#
# The tar: names sorted, every mtime SOURCE_DATE_EPOCH, uid/gid 0 numeric
# (no names), no xattrs/ACLs/SELinux labels, POSIX format without
# atime/ctime records, no device nodes. docker's own entries (/.dockerenv,
# /dev contents, its hosts/hostname/resolv.conf) are replaced by ours; /dev,
# /proc and /sys stay as empty dirs for proot to bind over.
#
# xz: preset 9 (64 MiB dictionary; the decoder needs ~65 MiB), always the
# multi-threaded encoder (a +1 thread count when one thread is asked), so the
# bytes do not depend on XZ_THREADS: blocks are 3 x the dictionary.
#
# Usage (build.sh): bash /recipe/pack.sh
# Env: SOURCE_DATE_EPOCH, ASSET (required); XZ_THREADS (default 2),
#      HOST_UID, HOST_GID (default 0), KEEP_TAR=1 keeps /out/rootfs.tar
set -euo pipefail
: "${SOURCE_DATE_EPOCH:?}" "${ASSET:?}"
export LC_ALL=C
umask 022

R=/recipe
IN=/in/raw.tar
OUT=/out
ROOT=/work/rootfs
threads="${XZ_THREADS:-2}"
[ "$threads" = 1 ] && threads=+1

# Whatever happens, what lands in /out belongs to the host user (the
# uncompressed tar stays in /work, inside the container).
trap 'chown "${HOST_UID:-0}:${HOST_GID:-0}" "$OUT"/* 2> /dev/null || true' EXIT
rm -rf /work
mkdir -p "$ROOT"
chmod 0755 "$ROOT"
tar --extract --file="$IN" --directory="$ROOT" --numeric-owner --same-permissions \
  --anchored --exclude=.dockerenv --exclude='dev/?*' --exclude='proc/?*' --exclude='sys/?*'
for f in hosts hostname resolv.conf; do
  rm -f "$ROOT/etc/$f"
  install -m 0644 "$R/files/etc/$f" "$ROOT/etc/$f"
done

# Package and source lists for the manifest and the GPL source bundle:
# every installed binary package's source, plus what was built into them
# statically (Built-Using, Static-Built-Using), at the exact versions.
q() { dpkg-query --admindir="$ROOT/var/lib/dpkg" -W -f="$1"; }
# shellcheck disable=SC2016 # ${...} below are dpkg-query fields, not shell
q '${binary:Package}\t${Version}\t${Architecture}\t${source:Package}\t${source:Version}\n' \
  | sort > "$OUT/packages.tsv"
# shellcheck disable=SC2016
{
  q '${source:Package}\t${source:Version}\n'
  q '${Built-Using},\n${Static-Built-Using},\n' | tr ',' '\n' \
    | sed -n 's/^ *\([^ (]*\) *(= *\([^ )]*\) *).*/\1\t\2/p'
} | sort -u > "$OUT/sources.tsv"

TAR=/work/rootfs.tar
tar --create --file="$TAR" --directory="$ROOT" \
  --sort=name --format=posix \
  --pax-option='exthdr.name=%d/PaxHeaders/%f,delete=atime,delete=ctime' \
  --mtime="@$SOURCE_DATE_EPOCH" --owner=0 --group=0 --numeric-owner \
  --no-xattrs --no-acls --no-selinux \
  .

tar_bytes="$(stat -c %s "$TAR")"
entries="$(tar --list --file="$TAR" | wc -l)"
start=$SECONDS
xz --compress --stdout -9 --threads="$threads" "$TAR" > "$OUT/$ASSET.part"
xz_seconds=$((SECONDS - start))
mv "$OUT/$ASSET.part" "$OUT/$ASSET"
(cd "$OUT" && sha256sum "$ASSET" > "$ASSET.sha256")
if [ "${KEEP_TAR:-0}" = 1 ]; then mv "$TAR" "$OUT/rootfs.tar"; fi

cat > "$OUT/pack.env" <<EOF
DEBIAN_VERSION=$(cat "$ROOT/etc/debian_version")
TAR_BYTES=$tar_bytes
ENTRIES=$entries
XZ_BYTES=$(stat -c %s "$OUT/$ASSET")
XZ_SECONDS=$xz_seconds
XZ_VERSION=$(xz --version | sed -n '1s/^xz (XZ Utils) //p')
TAR_VERSION=$(tar --version | sed -n '1s/^tar (GNU tar) //p')
EOF
echo "--- pack: $entries entries, tar $tar_bytes bytes, $ASSET $(stat -c %s "$OUT/$ASSET") bytes (xz ${xz_seconds}s) ---"
