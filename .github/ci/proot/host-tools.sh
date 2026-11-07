#!/usr/bin/env bash
# Host tools the lre/proot builds need on a GitHub runner: GNU awk
# (upstream's loader-info.awk is gawk-only; runner images may ship only
# mawk), make, binutils readelf, file, patch, curl, GNU tar, gzip. Whatever is
# missing is installed from apt in one go; a tool still missing after that is
# an error.
#
# Usage: bash .github/ci/proot/host-tools.sh   (tool versions on stdout)
set -euo pipefail

pkgs=()
if ! awk --version 2>/dev/null | grep -q 'GNU Awk' && ! command -v gawk >/dev/null; then
  pkgs+=(gawk)
fi
for tp in make:make readelf:binutils file:file patch:patch curl:curl tar:tar gzip:gzip; do
  command -v "${tp%%:*}" >/dev/null || pkgs+=("${tp#*:}")
done
if [ "${#pkgs[@]}" -gt 0 ]; then
  echo "installing: ${pkgs[*]}"
  sudo apt-get update -qq
  sudo apt-get install -y -qq --no-install-recommends "${pkgs[@]}"
fi

missing=()
for t in make readelf file patch curl tar gzip sha256sum; do
  command -v "$t" >/dev/null || missing+=("$t")
done
if ! awk --version 2>/dev/null | grep -q 'GNU Awk' && ! command -v gawk >/dev/null; then
  missing+=(gawk)
fi
if [ "${#missing[@]}" -gt 0 ]; then
  echo "::error::missing host tools: ${missing[*]}"
  exit 1
fi

{ gawk --version 2>/dev/null || awk --version; } | sed -n 1p
make --version | sed -n 1p
readelf --version | sed -n 1p
tar --version | sed -n 1p
