#!/usr/bin/env bash
# ELF checks on a native agent kind's payload libs. The libs are bionic
# (INTERP /system/bin/linker64): no CI runner can exec them,
# ubuntu-24.04-arm included (glibc, no bionic linker), so the proof is
# ELF-level, mirroring the kind's docs ("Verify before staging").
#
#   verify-elf.sh linkage <file> [engine]
#       NEEDED system-only (libc, libm, libdl); an engine also needs INTERP
#       /system/bin/linker64. stage.mjs runs it on every system-only lib.
#   verify-elf.sh sums <dir> <agent.json>
#       file(1) says ELF64 aarch64, sizes clear a floor, writes <dir>/SHA256SUMS.
#   verify-elf.sh deep <dir> <agent.json> <ndk-sysroot> <api>
#       ELF header, NEEDED system-only, the engine's INTERP and markers, and
#       the undefined-symbol scan against the NDK api-<api> stubs.
#
# sums and deep take the libs (name, role, linkage) from the manifest's
# payload.libs, and per-kind settings from ci/verify.env next to it, if any:
#   ENGINE_FLOOR_MIB    size floor of the engine lib in MiB (default 1; other libs 1)
#   ENGINE_MARKERS      strings the engine must contain (space-separated)
#   ENGINE_SYMBOL_GAPS  strict (default): the engine's unresolved symbols
#                       fail like any lib's; info: they are only reported
#
# Markdown tables on stdout (linkage: plain lines); exit 1 on any FAIL.
set -euo pipefail
export LC_ALL=C

fail=0
row() { printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4"; }
bad() { row "$1" "$2" "$3" "**FAIL**"; fail=1; }

# Dynamic symbol names (version suffix stripped). mode=und: non-weak undefined;
# mode=def: defined GLOBAL/WEAK. readelf -W columns: Num Value Size Type Bind
# Vis Ndx Name [(verindex)]; aarch64 may add [VARIANT_PCS] after Vis, so the
# name is taken from the end and UND matched as a word.
dynsyms() {
  readelf --dyn-syms -W "$1" | awk -v mode="$2" '
    $1 ~ /^[0-9]+:$/ && NF >= 8 {
      name = $NF
      if (name ~ /^\([0-9]+\)$/) name = $(NF - 1)
      sub(/@.*/, "", name)
      if (name == "") next
      und = ($0 ~ / UND /)
      if (mode == "und" && und && $5 != "WEAK") print name
      if (mode == "def" && !und && ($5 == "GLOBAL" || $5 == "WEAK")) print name
    }' | sort -u
}
needed() { readelf -dW "$1" | sed -n 's/.*(NEEDED).*\[\(.*\)\]/\1/p'; }
interp_of() { readelf -lW "$1" | sed -n 's/.*\[Requesting program interpreter: \(.*\)\]/\1/p'; }
system_only() { ! grep -qvxE 'lib(c|m|dl)\.so' <<<"$1"; }

# "<name>:<role>:<linkage>" per payload.libs entry, in manifest order.
LIBS=()
load_manifest() {
  local manifest="$1" knobs
  mapfile -t LIBS < <(jq -r '.payload.libs[] | "\(.name):\(.role):\(.linkage)"' "$manifest")
  [ "${#LIBS[@]}" -gt 0 ] || { echo "no payload.libs in $manifest" >&2; exit 2; }
  ENGINE_FLOOR_MIB=1 ENGINE_MARKERS="" ENGINE_SYMBOL_GAPS=strict
  knobs="$(dirname "$manifest")/ci/verify.env"
  # shellcheck source=/dev/null
  if [ -f "$knobs" ]; then . "$knobs"; fi
}

linkage() {
  local f="$1" role="${2:-}" name="${1##*/}" n other interp
  if [ ! -s "$f" ] || ! readelf -hW "$f" >/dev/null 2>&1; then
    echo "LINKAGE FAIL: $f is missing, empty or not an ELF file" >&2
    return 1
  fi
  n="$(needed "$f")"
  echo "$name: NEEDED $(paste -sd' ' - <<<"${n:-(none)}")"
  other="$(grep -vxE 'lib(c|m|dl)\.so' <<<"$n" || true)"
  if [ -n "$other" ]; then
    echo "LINKAGE FAIL: $name needs non-system libs: $(paste -sd' ' - <<<"$other")" >&2
    fail=1
  fi
  if [ "$role" = engine ]; then
    interp="$(interp_of "$f")"
    echo "$name: INTERP ${interp:-(none)}"
    if [ "$interp" != /system/bin/linker64 ]; then
      echo "LINKAGE FAIL: $name INTERP is ${interp:-(none)}, not /system/bin/linker64" >&2
      fail=1
    fi
  fi
  if [ "$fail" -eq 0 ]; then echo "$name: linkage OK (system-only)"; fi
  return "$fail"
}

sums() {
  local dir="$1" lib f role desc bytes mib sha floor names=()
  load_manifest "$2"
  cd "$dir"
  echo "### Payload"
  echo
  echo "| File | Size | SHA-256 | file(1) |"
  echo "|---|---|---|---|"
  for lib in "${LIBS[@]}"; do
    IFS=: read -r f role _ <<<"$lib"
    names+=("$f")
    if [ ! -s "$f" ]; then row "\`$f\`" - - "**missing or empty**"; fail=1; continue; fi
    desc="$(file -b "$f")"
    bytes="$(stat -c %s "$f")"
    mib=$(( bytes / 1048576 ))
    sha="$(sha256sum "$f" | cut -d' ' -f1)"
    row "\`$f\`" "$mib MiB ($bytes B)" "\`$sha\`" "$desc"
    case "$desc" in
      *"ELF 64-bit LSB"*"ARM aarch64"*) ;;
      *) echo "::error::$f is not an ELF64 aarch64 file: $desc" >&2; fail=1 ;;
    esac
    floor=1
    if [ "$role" = engine ]; then floor="$ENGINE_FLOOR_MIB"; fi
    if [ "$mib" -lt "$floor" ]; then
      echo "::error::$f is ${mib} MiB, below the ${floor} MiB floor" >&2; fail=1
    fi
  done
  if [ "$fail" -eq 0 ]; then
    sha256sum "${names[@]}" > SHA256SUMS
    echo
    echo "\`SHA256SUMS\` written next to the libs."
  fi
  echo
  return "$fail"
}

deep() {
  local dir="$1" sysroot="$3" api="$4" lib f role link m t n interp libdir stubs gaps count marker
  local engines=() others=()
  load_manifest "$2"
  cd "$dir"
  libdir="$sysroot/usr/lib/aarch64-linux-android/$api"
  echo "### Static checks (bionic arm64, api-$api)"
  echo
  echo "| Check | File | Detail | |"
  echo "|---|---|---|---|"

  for lib in "${LIBS[@]}"; do
    IFS=: read -r f role link <<<"$lib"
    if [ "$role" = engine ]; then engines+=("$f"); else others+=("$f"); fi
    m="$(readelf -hW "$f" | sed -n 's/^ *Machine: *//p')"
    t="$(readelf -hW "$f" | sed -n 's/^ *Type: *//p')"
    case "$m|$t" in
      "AArch64|DYN"*) row "ELF header" "\`$f\`" "$m, $t" OK ;;
      *) bad "ELF header" "\`$f\`" "$m, $t (want AArch64, DYN)" ;;
    esac
    if [ "$link" != system-only ]; then continue; fi
    n="$(needed "$f")"
    if [ -n "$n" ] && system_only "$n"; then
      row "NEEDED system-only" "\`$f\`" "$(paste -sd' ' - <<<"$n")" OK
    else
      bad "NEEDED system-only" "\`$f\`" "$(paste -sd' ' - <<<"${n:-(none)}")"
    fi
  done

  for f in "${engines[@]}"; do
    interp="$(interp_of "$f")"
    if [ "$interp" = /system/bin/linker64 ]; then row "INTERP" "\`$f\`" "\`$interp\`" OK
    else bad "INTERP" "\`$f\`" "\`${interp:-(none)}\` (want /system/bin/linker64)"; fi
    for marker in $ENGINE_MARKERS; do
      if grep -aqF -- "$marker" "$f"; then row "marker" "\`$f\`" "\`$marker\`" OK
      else bad "marker" "\`$f\`" "\`$marker\` not found"; fi
    done
  done

  # Undefined-symbol scan: every non-weak undefined symbol must be defined by
  # the api-level stub of a NEEDED lib, or dlopen fails on device with
  # "cannot locate symbol" (how pthread_tryjoin_np was found).
  local report=""
  for f in "${others[@]}" "${engines[@]}"; do
    stubs=()
    while IFS= read -r n; do
      if [ -f "$libdir/$n" ]; then stubs+=("$libdir/$n")
      else bad "symbol scan" "\`$f\`" "no api-$api stub for $n"; fi
    done < <(needed "$f")
    gaps="$(comm -23 <(dynsyms "$f" und) <(for s in "${stubs[@]}"; do dynsyms "$s" def; done | sort -u))"
    count="$(printf '%s' "$gaps" | grep -c . || true)"
    if [ "$count" -eq 0 ]; then
      row "symbol scan" "\`$f\`" "0 unresolved against api-$api stubs" OK
    elif [[ " ${engines[*]} " == *" $f "* ]] && [ "$ENGINE_SYMBOL_GAPS" = info ]; then
      row "symbol scan (info)" "\`$f\`" "$count unresolved against api-$api stubs (below)" INFO
    else
      bad "symbol scan" "\`$f\`" "$count unresolved against api-$api stubs (below)"
    fi
    if [ "$count" -gt 0 ]; then
      report+=$'\n'"<details><summary>$f: $count unresolved at api-$api</summary>"$'\n\n```\n'"$(sed -n '1,200p' <<<"$gaps")"$'\n```\n</details>\n'
    fi
  done
  if [ -n "$report" ]; then printf '%s\n' "$report"; fi
  echo
  return "$fail"
}

case "${1:-}" in
  linkage) linkage "${2:?file}" "${3:-}" ;;
  sums) sums "${2:?dir}" "$(realpath "${3:?agent.json}")" ;;
  deep) deep "${2:?dir}" "$(realpath "${3:?agent.json}")" "${4:?ndk sysroot}" "${5:?api}" ;;
  *) sed -n '2,23p' "$0" >&2; exit 2 ;;
esac
