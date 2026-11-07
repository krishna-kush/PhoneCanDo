#!/usr/bin/env bash
# ELF checks on the Android proot build (build-android.sh's out-dir), then
# <dir>/SHA256SUMS. The files are bionic arm64, so no CI runner can exec
# them: the proof is ELF-level, as in .github/ci/oc-payload/verify-payload.sh.
#
#   libproot.so         ELF64 AArch64 PIE, INTERP /system/bin/linker64,
#                       NEEDED system libs only (libc libm libdl liblog),
#                       built with PROOT_UNBUNDLE_LOADER (no embedded loader)
#   libproot-loader.so  ELF64 AArch64, static and freestanding by design (no
#                       INTERP, no NEEDED): proot execs it in the guest before
#                       any dynamic linker exists
#   both                every LOAD segment p_align >= 0x4000 (16 KB pages)
#
# Usage: lre/proot/verify.sh <dir>
#   markdown table on stdout; SHA256SUMS written only when every check
#   passes; exit 1 on any FAIL.
set -euo pipefail
export LC_ALL=C

DIR="${1:?usage: verify.sh <dir>}"
PROOT=libproot.so
LOADER=libproot-loader.so
MIN_ALIGN=$((0x4000))
fail=0
row() { printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4"; }
ok() { row "$1" "$2" "$3" OK; }
bad() { row "$1" "$2" "$3" "**FAIL**"; fail=1; }

interp() { readelf -lW "$1" | sed -n 's/.*\[Requesting program interpreter: \(.*\)\]/\1/p'; }
needed() { readelf -dW "$1" | sed -n 's/.*(NEEDED).*\[\(.*\)\]/\1/p'; }
header() { readelf -hW "$1" | sed -n "s/^ *$2: *//p"; }
load_aligns() { readelf -lW "$1" | awk '$1 == "LOAD" { print $NF }'; }

cd "$DIR"
echo "### proot (Android arm64)"
echo
echo "| Check | File | Detail | |"
echo "|---|---|---|---|"

present=()
for f in "$PROOT" "$LOADER"; do
  if [ ! -s "$f" ]; then bad "present" "\`$f\`" "missing or empty"; continue; fi
  present+=("$f")
  desc="$(file -b "$f")"
  case "$desc" in
    *"ELF 64-bit LSB"*"ARM aarch64"*) ok "ELF64 aarch64" "\`$f\`" "$(stat -c %s "$f") B; ${desc%%,*}" ;;
    *) bad "ELF64 aarch64" "\`$f\`" "$desc" ;;
  esac

  aligns="$(load_aligns "$f")"
  if [ -z "$aligns" ]; then
    bad "LOAD p_align" "\`$f\`" "no LOAD segments"
  else
    small=""
    while read -r a; do
      if [ "$((a))" -lt "$MIN_ALIGN" ]; then small+="$a "; fi
    done <<<"$aligns"
    if [ -z "$small" ]; then ok "LOAD p_align >= 0x4000" "\`$f\`" "$(paste -sd' ' - <<<"$aligns")"
    else bad "LOAD p_align >= 0x4000" "\`$f\`" "below 16 KB: ${small% }"; fi
  fi
done

if [[ " ${present[*]} " == *" $PROOT "* ]]; then
  t="$(header "$PROOT" Type)"
  case "$t" in
    DYN*) ok "ELF type" "\`$PROOT\`" "$t" ;;
    *) bad "ELF type" "\`$PROOT\`" "$t (want DYN, a PIE)" ;;
  esac
  i="$(interp "$PROOT")"
  if [ "$i" = /system/bin/linker64 ]; then ok "INTERP" "\`$PROOT\`" "\`$i\`"
  else bad "INTERP" "\`$PROOT\`" "\`${i:-(none)}\` (want /system/bin/linker64)"; fi
  n="$(needed "$PROOT")"
  if [ -n "$n" ] && ! grep -qvxE 'lib(c|m|dl|log)\.so' <<<"$n"; then
    ok "NEEDED system-only" "\`$PROOT\`" "$(paste -sd' ' - <<<"$n")"
  else
    bad "NEEDED system-only" "\`$PROOT\`" "$(paste -sd' ' - <<<"${n:-(none)}")"
  fi
  # build-android.sh's PROOT_UNBUNDLE_LOADER fallback dir; only an
  # unbundled build carries it (a bundled one extracts the loader to tmp).
  if grep -aqF /PROOT_LOADER-unset/loader "$PROOT"; then
    ok "loader unbundled" "\`$PROOT\`" "execs \$PROOT_LOADER"
  else
    bad "loader unbundled" "\`$PROOT\`" "no PROOT_UNBUNDLE_LOADER marker: loader embedded?"
  fi
fi

if [[ " ${present[*]} " == *" $LOADER "* ]]; then
  t="$(header "$LOADER" Type)"
  case "$t" in
    EXEC*) ok "ELF type" "\`$LOADER\`" "$t, entry $(header "$LOADER" 'Entry point address')" ;;
    *) bad "ELF type" "\`$LOADER\`" "$t (want EXEC at a fixed address)" ;;
  esac
  i="$(interp "$LOADER")"
  n="$(needed "$LOADER")"
  if [ -z "$i" ] && [ -z "$n" ]; then ok "static (no INTERP, no NEEDED)" "\`$LOADER\`" "freestanding"
  else bad "static (no INTERP, no NEEDED)" "\`$LOADER\`" "INTERP ${i:-none}; NEEDED $(paste -sd' ' - <<<"${n:-none}")"; fi
fi

echo
if [ "$fail" -eq 0 ]; then
  sha256sum "$PROOT" "$LOADER" > SHA256SUMS
  echo '```'
  cat SHA256SUMS
  echo '```'
  echo
  echo "\`SHA256SUMS\` written next to the libs."
else
  rm -f SHA256SUMS
  echo "**FAIL**: no SHA256SUMS written."
fi
echo
exit "$fail"
