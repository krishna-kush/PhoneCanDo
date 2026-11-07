#!/bin/bash
# Bake the Default env rootfs: runs as root INSIDE a container of the pinned
# debian image (build.sh starts it; never run it on a host). Installs the
# Standard set from the pinned snapshot, bakes our proot settings, strips
# what a phone does not need and leaves no build-time state behind, so the
# same inputs give the same files. docker owns /etc/hosts, /etc/hostname and
# /etc/resolv.conf while this runs; pack.sh writes ours.
#
# Usage (build.sh): bash /recipe/bake.sh
# Env (all required): SNAPSHOT, SOURCE_DATE_EPOCH, IMAGE_VERSION, DEBIAN_TAG,
#   DEBIAN_DIGEST, RECIPE_SHA256
set -euo pipefail
: "${SNAPSHOT:?}" "${SOURCE_DATE_EPOCH:?}" "${IMAGE_VERSION:?}" "${DEBIAN_TAG:?}" \
  "${DEBIAN_DIGEST:?}" "${RECIPE_SHA256:?}"
# SOURCE_DATE_EPOCH also makes useradd date /etc/shadow with it and
# py_compile write hash-checked .pyc files (valid whatever mtime the app's
# unpacker gives the .py files); a fixed hash seed keeps them byte-stable.
export SOURCE_DATE_EPOCH DEBIAN_FRONTEND=noninteractive LC_ALL=C.UTF-8 PYTHONHASHSEED=0
umask 022

R=/recipe
SOURCES=/etc/apt/sources.list.d/debian.sources
BUILD_CONF=/etc/apt/apt.conf.d/00phonecando-build
# shellcheck source=/dev/null
. /etc/os-release
codename="${VERSION_CODENAME:?no VERSION_CODENAME in /etc/os-release}"

echo "--- bake: $PRETTY_NAME, snapshot $SNAPSHOT, $(dpkg --print-architecture) ---"

# Our files first: the slim rules must be in place before anything installs.
for f in apt/apt.conf.d/99phonecando-proot dpkg/dpkg.cfg.d/99phonecando-slim \
         default/locale profile.d/phonecando-locale.sh; do
  install -D -m 0644 "$R/files/etc/$f" "/etc/$f"
done

# apt from the snapshot for the build only; the image keeps Debian's own
# sources (deb.debian.org), so `apt-get update` there gets current packages.
keyring="$(sed -n 's/^Signed-By: *//p' "$SOURCES" | head -n 1)"
cp -p "$SOURCES" /tmp/debian.sources.orig
cat > "$SOURCES" <<EOF
Types: deb
URIs: http://snapshot.debian.org/archive/debian/$SNAPSHOT
Suites: $codename $codename-updates
Components: main
Signed-By: $keyring

Types: deb
URIs: http://snapshot.debian.org/archive/debian-security/$SNAPSHOT
Suites: $codename-security
Components: main
Signed-By: $keyring
EOF
# Snapshot Release files are past their Valid-Until; snapshot.debian.org
# is slow at times, so retry instead of failing the build.
cat > "$BUILD_CONF" <<'EOF'
Acquire::Check-Valid-Until "false";
Acquire::Retries "5";
Acquire::http::Timeout "120";
EOF

mapfile -t packages < <(sed -e 's/#.*//' -e 's/[[:space:]]//g' -e '/^$/d' "$R/packages.txt")
apt-get update
apt-get -y upgrade
apt-get -y install --no-install-recommends "${packages[@]}"

mv /tmp/debian.sources.orig "$SOURCES"
rm -f "$BUILD_CONF"

# What the base image shipped before our slim rules existed: same rules by
# hand. Directories stay (some postinst scripts expect /usr/share/man/man1).
find /usr/share/doc -mindepth 2 ! -type d ! -name copyright -delete
find /usr/share/doc -mindepth 2 -depth -type d -empty -delete
for d in man info groff linda lintian; do
  [ -d "/usr/share/$d" ] && find "/usr/share/$d" -mindepth 1 ! -type d -delete
done
if [ -d /usr/share/locale ]; then
  find /usr/share/locale -mindepth 1 -maxdepth 1 ! -name locale.alias -exec rm -rf {} +
fi

# Build-time state: package lists (run `apt-get update` first), caches, logs
# and dpkg's backups carry dates or are rebuilt on demand.
apt-get clean
rm -rf /var/lib/apt/lists/* /var/cache/apt/*.bin /var/cache/ldconfig/aux-cache \
       /var/log/apt/* /var/log/*.log /tmp/* /var/tmp/* /root/.cache
rm -f /var/lib/dpkg/*-old /var/cache/debconf/*-old

cat > /etc/phonecando-image <<EOF
# PhoneCanDo Default env: a Debian-based image, built once and never changed.
NAME=default
VERSION=$IMAGE_VERSION
DEBIAN_TAG=$DEBIAN_TAG
DEBIAN_DIGEST=$DEBIAN_DIGEST
DEBIAN_SNAPSHOT=$SNAPSHOT
RECIPE_SHA256=$RECIPE_SHA256
EOF
chmod 0644 /etc/phonecando-image

echo "--- bake: $(dpkg-query -W | wc -l) packages, $(du -sx --block-size=1M / | cut -f1) MiB ---"
