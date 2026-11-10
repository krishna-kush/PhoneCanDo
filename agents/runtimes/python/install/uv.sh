#!/bin/sh
# Python for every family (runtime.json `install` "*"): Astral's uv, the
# pinned official aarch64 build from its GitHub release, checked against its
# sha256 and unpacked into $HOME/.local/opt/python/bin (runtime.json
# `paths`), then CPython $PYTHON_VERSION installed by uv itself. Kinds
# install their package with `uv tool install --python $PYTHON_VERSION`.
#
# We take uv's musl build on every family: it is statically linked, so the
# same file runs on glibc and musl images. uv downloads CPython from the
# python-build-standalone releases (glibc and musl builds for aarch64) and
# checks each against the sha256 that uv carries, so pinning uv pins those
# too. uv keeps its Pythons in $HOME/.local/share/uv/python. Only uv and
# uvx go on PATH: the image's own python3 stays the agent's python3.
#
# Idempotent: a uv of the pinned version is kept, and `uv python install`
# does nothing when that Python is already there. A new uv is unpacked and
# run beside the old one first, then swapped in, so the destination never
# holds a half-unpacked tree; a run cut short leaves only
# $HOME/.local/opt/.python-install, which the next run clears.
#
# Needs curl or wget, tar, gzip, sha256sum and a CA bundle for the uv
# download; we install the missing ones (but sha256sum) with the image's own
# package manager first. uv itself needs no CA bundle (it carries its own
# roots).
#
# Pins: the uv version and the sha256 of its .tar.gz, from the release's
# .sha256 file (README.md). Bump both together.
set -eu

UV_VERSION=0.13.7
UV_SHA256=2d3ec076a0c4c0e8250bb6418c44080828b544f1a3be0b6e46adf9fb6923de45
PYTHON_VERSION=3.12

UV_DIST="uv-aarch64-unknown-linux-musl"
UV_URL="https://github.com/astral-sh/uv/releases/download/$UV_VERSION/$UV_DIST.tar.gz"

: "${HOME:?HOME must be set}"
OPT="$HOME/.local/opt"
DEST="$OPT/python"
WORK="$OPT/.python-install"
UV="$DEST/bin/uv"

say() { printf 'python: %s\n' "$*"; }
die() {
  printf 'python: %s\n' "$*" >&2
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
  have gzip || need="$need gzip"
  ca_bundle || need="$need ca-certificates"
  [ -z "$need" ] && return 0

  pm=""
  for c in apt-get dnf microdnf yum pacman zypper apk xbps-install; do
    if have "$c"; then
      pm="$c"
      break
    fi
  done
  [ -n "$pm" ] || die "missing$need and no package manager to install them"

  pkgs=""
  for t in $need; do
    case "$pm:$t" in
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
    apk) apk add $pkgs ;;
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

uv_is_pinned() {
  case "$("$1" --version 2>/dev/null || true)" in
    "uv $UV_VERSION" | "uv $UV_VERSION "*) return 0 ;;
  esac
  return 1
}

case "$(uname -m)" in
  aarch64 | arm64) ;;
  *) die "the pinned build is aarch64; this machine is $(uname -m)" ;;
esac

if uv_is_pinned "$UV"; then
  say "uv $UV_VERSION is already in $DEST/bin"
else
  ensure_tools
  have sha256sum || die "sha256sum is missing (coreutils or busybox)"

  rm -rf "$WORK"
  mkdir -p "$WORK"
  trap 'rm -rf "$WORK"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  say "downloading $UV_URL"
  fetch "$UV_URL" "$WORK/uv.tar.gz" || die "download failed: $UV_URL"
  got="$(sha256sum "$WORK/uv.tar.gz" | cut -d ' ' -f 1)"
  [ "$got" = "$UV_SHA256" ] || die "sha256 mismatch for $UV_DIST.tar.gz: got $got, want $UV_SHA256"

  # -o: keep our own uid, never the archive's owners.
  tar -xzof "$WORK/uv.tar.gz" -C "$WORK"
  rm -f "$WORK/uv.tar.gz"
  mkdir -p "$WORK/new/bin"
  mv "$WORK/$UV_DIST/uv" "$WORK/$UV_DIST/uvx" "$WORK/new/bin/"
  uv_is_pinned "$WORK/new/bin/uv" || die "the unpacked uv does not run or is not $UV_VERSION"

  mkdir -p "$OPT"
  rm -rf "$WORK/old"
  if [ -e "$DEST" ] || [ -L "$DEST" ]; then
    mv "$DEST" "$WORK/old"
  fi
  mv "$WORK/new" "$DEST"
  say "uv $UV_VERSION in $DEST/bin"
fi

# A no-op when this Python is already installed.
"$UV" python install "$PYTHON_VERSION"
found="$("$UV" python find "$PYTHON_VERSION")" || die "uv finds no Python $PYTHON_VERSION after installing it"
say "Python $PYTHON_VERSION at $found"
