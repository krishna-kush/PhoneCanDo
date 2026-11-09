#!/bin/sh
# Node.js for every glibc family (runtime.json `install` "*"): the pinned
# official linux-arm64 build from nodejs.org, checked against its sha256 and
# unpacked into $HOME/.local/opt/node (runtime.json `paths`). It lives under
# HOME, so it survives a machine reset.
#
# Idempotent: when the pinned version is already in place we do nothing. A
# new tree is unpacked and run beside the old one first, then swapped in, so
# the destination never holds a half-unpacked tree; a run cut short leaves
# only $HOME/.local/opt/.node-install, which the next run clears.
#
# Needs curl or wget, tar, xz, sha256sum and a CA bundle. The Default image
# has them all; other images often lack curl, xz or the CA bundle, and we
# install the missing ones with the image's own package manager first.
#
# Pins: the version and the sha256 of its .tar.xz, from
# https://nodejs.org/dist/v<version>/SHASUMS256.txt, whose signature we check
# against a Node.js release key when we bump them (README.md). Bump both
# together.
set -eu

NODE_VERSION=22.23.4
NODE_SHA256=6287aa46b6c375d816e63ae66d024fbbfd70404825aabdfdf898a970871d2f4b

NODE_DIST="node-v$NODE_VERSION-linux-arm64"
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/$NODE_DIST.tar.xz"

: "${HOME:?HOME must be set}"
OPT="$HOME/.local/opt"
DEST="$OPT/node"
WORK="$OPT/.node-install"

say() { printf 'node: %s\n' "$*"; }
die() {
  printf 'node: %s\n' "$*" >&2
  exit 1
}
have() { command -v "$1" >/dev/null 2>&1; }

ca_bundle() {
  for f in /etc/ssl/certs/ca-certificates.crt /etc/pki/tls/certs/ca-bundle.crt \
    /etc/ssl/ca-bundle.pem /etc/ssl/cert.pem; do
    [ -s "$f" ] && return 0
  done
  return 1
}

# The tools we lack, by generic name, installed in lre's family detection
# order (lre/image Families.kt); a family names some of them its own way.
ensure_tools() {
  need=""
  have curl || have wget || need="$need curl"
  have tar || need="$need tar"
  have xz || need="$need xz"
  ca_bundle || need="$need ca-certificates"
  [ -z "$need" ] && return 0

  pm=""
  for c in apt-get dnf microdnf yum pacman zypper xbps-install; do
    if have "$c"; then
      pm="$c"
      break
    fi
  done
  [ -n "$pm" ] || die "missing$need and no package manager to install them"

  pkgs=""
  for t in $need; do
    case "$pm:$t" in
      apt-get:xz) pkgs="$pkgs xz-utils" ;;
      zypper:ca-certificates) pkgs="$pkgs ca-certificates ca-certificates-mozilla" ;;
      *) pkgs="$pkgs $t" ;;
    esac
  done
  say "installing$pkgs with $pm"
  # $pkgs is a word list on purpose.
  # shellcheck disable=SC2086
  case "$pm" in
    apt-get)
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $pkgs
      ;;
    pacman) pacman -Sy --noconfirm --needed $pkgs ;;
    zypper) zypper -n install $pkgs ;;
    xbps-install) xbps-install -Sy $pkgs ;;
    *) "$pm" install -y $pkgs ;;
  esac
}

fetch() {
  if have curl; then
    curl -fsSL --proto =https --tlsv1.2 --retry 3 --connect-timeout 30 -o "$2" "$1"
  else
    wget -q -T 30 -O "$2" "$1"
  fi
}

case "$(uname -m)" in
  aarch64 | arm64) ;;
  *) die "the pinned build is linux-arm64; this machine is $(uname -m)" ;;
esac

if [ -x "$DEST/bin/node" ] && [ "$("$DEST/bin/node" --version 2>/dev/null || true)" = "v$NODE_VERSION" ]; then
  say "v$NODE_VERSION is already in $DEST"
  exit 0
fi

ensure_tools
have sha256sum || die "sha256sum is missing (coreutils or busybox)"

rm -rf "$WORK"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

say "downloading $NODE_URL"
fetch "$NODE_URL" "$WORK/node.tar.xz" || die "download failed: $NODE_URL"
got="$(sha256sum "$WORK/node.tar.xz" | cut -d ' ' -f 1)"
[ "$got" = "$NODE_SHA256" ] || die "sha256 mismatch for $NODE_DIST.tar.xz: got $got, want $NODE_SHA256"

say "unpacking into $DEST"
# -o: keep our own uid, never the archive's owners.
tar -xJof "$WORK/node.tar.xz" -C "$WORK"
rm -f "$WORK/node.tar.xz"
NEW="$WORK/$NODE_DIST"
[ -x "$NEW/bin/node" ] || die "$NODE_DIST.tar.xz holds no bin/node"
ran="$("$NEW/bin/node" --version 2>&1)" ||
  die "the unpacked node does not run (it needs glibc 2.28 or newer): $ran"
[ "$ran" = "v$NODE_VERSION" ] || die "the unpacked node says $ran, want v$NODE_VERSION"

rm -rf "$WORK/old"
if [ -e "$DEST" ] || [ -L "$DEST" ]; then
  mv "$DEST" "$WORK/old"
fi
mv "$NEW" "$DEST"
say "$ran in $DEST"
