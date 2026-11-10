#!/usr/bin/env bash
# ELF checks on the Android llama-server build (build.sh's out-dir), then
# <dir>/SHA256SUMS. The file is bionic arm64, so no CI runner can exec it:
# the proof is ELF-level, as for proot (lre/proot/verify.sh).
#
#   libllama-server.so  ELF64 AArch64 PIE built by pins.env's NDK for an
#                       Android API no newer than pins.env's,
#                       INTERP /system/bin/linker64, NEEDED system libs only
#                       (libc libm libdl liblog: ggml and libc++ are linked
#                       in), no RPATH/RUNPATH, every LOAD segment
#                       p_align >= 0x4000 (16 KB pages), and the strings
#                       lme/host relies on: the LLAMA_API_KEY variable and
#                       the three wire APIs LlamaCppRuntime promises
#
# Usage: lme/llamacpp/verify.sh <dir>
#   markdown table on stdout; SHA256SUMS written only when every check
#   passes; exit 1 on any FAIL.
set -euo pipefail
export LC_ALL=C

DIR="${1:?usage: verify.sh <dir>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=pins.env
. "$HERE/pins.env"
LIB=libllama-server.so
MIN_ALIGN=$((0x4000))
MARKERS=(LLAMA_API_KEY /v1/chat/completions /v1/responses /v1/messages /health)
fail=0
row() { printf '| %s | %s | %s |\n' "$1" "$2" "$3"; }
ok() { row "$1" "$2" OK; }
bad() { row "$1" "$2" "**FAIL**"; fail=1; }

interp() { readelf -lW "$1" | sed -n 's/.*\[Requesting program interpreter: \(.*\)\]/\1/p'; }
needed() { readelf -dW "$1" | sed -n 's/.*(NEEDED).*\[\(.*\)\]/\1/p'; }
header() { readelf -hW "$1" | sed -n "s/^ *$2: *//p"; }
load_aligns() { readelf -lW "$1" | awk '$1 == "LOAD" { print $NF }'; }
# The NDK's .note.android.ident, as "<api> <ndk>": a little-endian u32 API
# level, then the NDK release as a NUL-padded string (r28c).
android_note() {
  readelf -nW "$1" | sed -n 's/.*Android .*description data: *//p' | head -n1 | awk '
    function hex(h,   v, k) {
      h = tolower(h)
      for (k = 1; k <= length(h); k++) v = v * 16 + index("0123456789abcdef", substr(h, k, 1)) - 1
      return v
    }
    {
      api = 0
      for (i = 4; i >= 1; i--) api = api * 256 + hex($i)
      ndk = ""
      for (i = 5; i <= NF && $i != "00"; i++) ndk = ndk sprintf("%c", hex($i))
      print api, ndk
    }'
}

cd "$DIR"
echo "### llama-server (Android arm64)"
echo
echo "| Check | Detail | |"
echo "|---|---|---|"

if [ ! -s "$LIB" ]; then
  bad "present" "\`$LIB\` missing or empty"
else
  desc="$(file -b "$LIB")"
  case "$desc" in
    *"ELF 64-bit LSB"*"ARM aarch64"*) ok "ELF64 aarch64" "$(stat -c %s "$LIB") B; ${desc%%,*}" ;;
    *) bad "ELF64 aarch64" "$desc" ;;
  esac

  t="$(header "$LIB" Type)"
  case "$t" in
    DYN*) ok "ELF type" "$t" ;;
    *) bad "ELF type" "$t (want DYN, a PIE)" ;;
  esac

  i="$(interp "$LIB")"
  if [ "$i" = /system/bin/linker64 ]; then ok "INTERP" "\`$i\`"
  else bad "INTERP" "\`${i:-(none)}\` (want /system/bin/linker64)"; fi

  n="$(needed "$LIB")"
  if [ -n "$n" ] && ! grep -qvxE 'lib(c|m|dl|log)\.so' <<<"$n"; then
    ok "NEEDED system-only" "$(paste -sd' ' - <<<"$n")"
  else
    bad "NEEDED system-only" "$(paste -sd' ' - <<<"${n:-(none)}")"
  fi

  if readelf -dW "$LIB" | grep -qE '\((RPATH|RUNPATH)\)'; then bad "no RPATH/RUNPATH" "$(readelf -dW "$LIB" | grep -E 'RPATH|RUNPATH')"
  else ok "no RPATH/RUNPATH" "none"; fi

  read -r api ndk <<<"$(android_note "$LIB")" || true
  if [ "${api:-0}" -ge 21 ] && [ "$api" -le "$ANDROID_API" ] && [ "${ndk:-}" = "$NDK_VERSION" ]; then
    ok "Android note" "API $api, NDK $ndk (pins.env: $ANDROID_API, $NDK_VERSION)"
  else
    bad "Android note" "API ${api:-?}, NDK ${ndk:-?} (pins.env: $ANDROID_API, $NDK_VERSION)"
  fi

  aligns="$(load_aligns "$LIB")"
  if [ -z "$aligns" ]; then
    bad "LOAD p_align" "no LOAD segments"
  else
    small=""
    while read -r a; do
      if [ "$((a))" -lt "$MIN_ALIGN" ]; then small+="$a "; fi
    done <<<"$aligns"
    if [ -z "$small" ]; then ok "LOAD p_align >= 0x4000" "$(paste -sd' ' - <<<"$aligns")"
    else bad "LOAD p_align >= 0x4000" "below 16 KB: ${small% }"; fi
  fi

  missing=""
  for m in "${MARKERS[@]}"; do
    grep -aqF -- "$m" "$LIB" || missing+="$m "
  done
  if [ -z "$missing" ]; then ok "markers" "${MARKERS[*]}"
  else bad "markers" "missing: ${missing% }"; fi
fi

echo
if [ "$fail" -eq 0 ]; then
  sha256sum "$LIB" > SHA256SUMS
  echo '```'
  cat SHA256SUMS
  echo '```'
  echo
  echo "\`SHA256SUMS\` written next to the lib."
else
  rm -f SHA256SUMS
  echo "**FAIL**: no SHA256SUMS written."
fi
echo
exit "$fail"
