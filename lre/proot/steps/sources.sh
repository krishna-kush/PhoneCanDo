#!/usr/bin/env bash
# shellcheck shell=bash
# Pinned sources for the proot build, sourced by the lre/proot entry scripts
# (not run on its own).
#
#   pins_load                        source ../pins.env, fail on a missing pin
#   sources_fetch <workdir>          both tarballs into <workdir>/downloads,
#                                    sha256-verified; a verified copy already
#                                    there is reused (the offline cache)
#   unpack_fresh <tarball> <dir>     <dir> emptied, the tarball's top-level
#                                    directory extracted into it
#   patches_apply <tree>             lre/proot/patches/*.patch in name order,
#                                    patch -p1
#
# Sets PROOT_DIR (lre/proot), PROOT_TARBALL and TALLOC_TARBALL.

PROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

pins_load() {
  local k
  # shellcheck source=../pins.env
  . "$PROOT_DIR/pins.env"
  for k in PROOT_COMMIT PROOT_VERSION PROOT_COMMIT_DATE PROOT_URL PROOT_SHA256 \
           TALLOC_VERSION TALLOC_URL TALLOC_MIRROR_URL TALLOC_SHA256 ANDROID_API; do
    if [ -z "${!k:-}" ]; then echo "pins: $k missing from $PROOT_DIR/pins.env" >&2; return 1; fi
  done
}

sha256_of() { sha256sum "$1" | cut -d' ' -f1; }

# fetch_verified <dest> <sha256> <url>... : first URL whose bytes match wins.
fetch_verified() {
  local dest="$1" want="$2" url got
  shift 2
  if [ -f "$dest" ] && [ "$(sha256_of "$dest")" = "$want" ]; then
    echo "cached: $(basename "$dest") (sha256 ok)" >&2
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  rm -f "$dest" "$dest.part"
  for url in "$@"; do
    echo "fetch: $url" >&2
    # Short limits: the files are a few MB, and a hanging host (samba.org has
    # been) should hand over to the next URL, not stall the build.
    if curl -fsSL --retry 1 --retry-delay 5 --connect-timeout 20 --max-time 120 \
         -o "$dest.part" "$url"; then
      got="$(sha256_of "$dest.part")"
      if [ "$got" = "$want" ]; then
        mv "$dest.part" "$dest"
        return 0
      fi
      echo "fetch: sha256 mismatch from $url (want $want, got $got)" >&2
    fi
    rm -f "$dest.part"
  done
  echo "fetch FAIL: no source gave $(basename "$dest") with sha256 $want" >&2
  return 1
}

sources_fetch() {
  local dl="$1/downloads"
  # shellcheck disable=SC2034 # read by the entry scripts
  PROOT_TARBALL="$dl/proot-$PROOT_COMMIT.tar.gz"
  # shellcheck disable=SC2034 # read by the entry scripts
  TALLOC_TARBALL="$dl/talloc-$TALLOC_VERSION.tar.gz"
  fetch_verified "$PROOT_TARBALL" "$PROOT_SHA256" "$PROOT_URL"
  fetch_verified "$TALLOC_TARBALL" "$TALLOC_SHA256" "$TALLOC_URL" "$TALLOC_MIRROR_URL"
}

unpack_fresh() {
  local tarball="$1" dir="$2"
  rm -rf "$dir"
  mkdir -p "$dir"
  tar -xzf "$tarball" -C "$dir" --strip-components=1 --no-same-owner
}

patches_apply() {
  local tree="$1" p
  for p in "$PROOT_DIR"/patches/*.patch; do
    [ -e "$p" ] || continue
    echo "patch: $(basename "$p")" >&2
    patch -p1 --batch --forward --no-backup-if-mismatch -d "$tree" < "$p"
  done
}
