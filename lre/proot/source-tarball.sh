#!/usr/bin/env bash
# The GPL "corresponding source" for one proot build, as one deterministic
# .tar.gz we publish with every release that ships libproot.so:
#
#   phonecando-proot-<PROOT_VERSION>-source/
#     SOURCES.txt                       what each part is and how to rebuild
#     downloads/proot-<commit>.tar.gz   termux/proot at the pinned commit,
#                                       byte-for-byte the archive we build
#                                       from (sha256 in pins.env)
#     downloads/talloc-<ver>.tar.gz     the talloc release tarball, same
#     lre/proot/                        our build scripts, pins.env, patches/
#                                       and the talloc build config
#
# Deterministic: sorted names, mtime = PROOT_COMMIT_DATE, owner 0:0, fixed
# modes, gzip -n. Same pins and scripts give the same bytes (GNU tar and
# gzip; the downloads come from <workdir>/downloads like the builds use).
#
# Usage: lre/proot/source-tarball.sh <workdir> <out-file>
set -euo pipefail
export LC_ALL=C TZ=UTC
umask 022

WORK="${1:?usage: source-tarball.sh <workdir> <out-file>}"
OUT="${2:?usage: source-tarball.sh <workdir> <out-file>}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=steps/sources.sh
. "$HERE/steps/sources.sh"
pins_load

mkdir -p "$WORK" "$(dirname "$OUT")"
WORK="$(cd "$WORK" && pwd)"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
sources_fetch "$WORK"

TOP="phonecando-proot-$PROOT_VERSION-source"
STAGE="$WORK/source-tarball"
DEST="$STAGE/$TOP"
rm -rf "$STAGE"
mkdir -p "$DEST/downloads" "$DEST/lre/proot"
install -m 0644 "$PROOT_TARBALL" "$TALLOC_TARBALL" "$DEST/downloads/"

# Our build inputs only (scripts, pins, patches, talloc config) and their
# licence, never whatever else sits in a working copy.
while IFS= read -r -d '' f; do
  case "$f" in *.sh) mode=0755 ;; *) mode=0644 ;; esac
  install -D -m "$mode" "$PROOT_DIR/$f" "$DEST/lre/proot/$f"
done < <(cd "$PROOT_DIR" && find . -type f \
  \( -name '*.sh' -o -name '*.env' -o -name '*.patch' -o -name '*.c' -o -name '*.h' -o -name LICENSE \) \
  -printf '%P\0' | sort -z)

patches="$(cd "$PROOT_DIR" && find patches -name '*.patch' 2>/dev/null | sort | sed 's/^/    lre\/proot\//')"
cat > "$DEST/SOURCES.txt" <<EOF
proot $PROOT_VERSION for PhoneCanDo: corresponding source

libproot.so and libproot-loader.so in PhoneCanDo are built from exactly
these files and nothing else.

downloads/proot-$PROOT_COMMIT.tar.gz
    termux/proot at commit $PROOT_COMMIT (tag v$PROOT_VERSION)
    GPL-2.0-or-later, see COPYING inside
    $PROOT_URL
    sha256 $PROOT_SHA256

downloads/talloc-$TALLOC_VERSION.tar.gz
    talloc $TALLOC_VERSION, linked statically into libproot.so
    LGPL-3.0-or-later, see LICENSE inside
    $TALLOC_URL
    sha256 $TALLOC_SHA256

lre/proot/
    our build scripts, pins (pins.env), the talloc build config (talloc/)
    and the patches we apply to proot:
${patches:-    (none)}

Rebuild on Linux x86_64 with Android NDK $NDK_VERSION, GNU make, GNU awk
(gawk), binutils readelf, GNU tar and file(1), from this directory:

    ANDROID_NDK_HOME=/path/to/android-ndk-$NDK_VERSION lre/proot/build-android.sh . out
    lre/proot/verify.sh out

The build reuses the verified tarballs in downloads/ (no network) and is
deterministic: out/SHA256SUMS matches the one published with the release.
EOF
chmod 0644 "$DEST/SOURCES.txt"
find "$DEST" -type d -exec chmod 0755 {} +

epoch="$(date -u -d "$PROOT_COMMIT_DATE" +%s)"
tar --sort=name --format=gnu --mtime="@$epoch" \
    --owner=0 --group=0 --numeric-owner \
    -C "$STAGE" -cf - "$TOP" | gzip -n -9 > "$OUT.part"
mv "$OUT.part" "$OUT"

echo "### proot corresponding source"
echo
echo "| File | Size | SHA-256 |"
echo "|---|---|---|"
printf '| `%s` | %s B | `%s` |\n' "$(basename "$OUT")" "$(stat -c %s "$OUT")" "$(sha256_of "$OUT")"
echo
echo '```'
tar -tzf "$OUT"
echo '```'
