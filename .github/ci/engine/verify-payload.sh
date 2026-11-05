#!/usr/bin/env bash
# Static checks on the staged engine payload (stage-v2.sh's libs/arm64-v8a).
# The payload is bionic (INTERP /system/bin/linker64): no CI runner can exec it,
# ubuntu-24.04-arm included (glibc, no bionic linker), so the proof is
# ELF-level, mirroring oc-build.md "Verify before staging".
#
#   verify-payload.sh sums <dir>
#       file(1) says ELF64 aarch64, sizes clear a floor, writes <dir>/SHA256SUMS.
#   verify-payload.sh deep <dir> <ndk-sysroot> <api>
#       INTERP, NEEDED system-only (both files), the markers oc-build.md lists,
#       and the undefined-symbol scan against the NDK api-<api> stubs (the
#       renderer must have zero gaps; the payload's gaps are reported only).
#
# Markdown tables on stdout; exit 1 on any FAIL.
set -euo pipefail
export LC_ALL=C

PAYLOAD=libopencode2.so
RENDERER=libopentui.so
fail=0
row() { printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4"; }
bad() { row "$1" "$2" "$3" "**FAIL**"; fail=1; }

# Floors catch a stub or truncated output, not size drift: the Bun runtime
# alone is ~90 MB unpacked, and the unstripped renderer carries ~16 MB of
# debug info (AGP strips it later, see oc-build.md).
floor_mib() { case "$1" in "$PAYLOAD") echo 40 ;; *) echo 1 ;; esac; }

sums() {
  local dir="$1" f desc bytes mib sha
  cd "$dir"
  echo "### Payload"
  echo
  echo "| File | Size | SHA-256 | file(1) |"
  echo "|---|---|---|---|"
  for f in "$PAYLOAD" "$RENDERER"; do
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
    if [ "$mib" -lt "$(floor_mib "$f")" ]; then
      echo "::error::$f is ${mib} MiB, below the $(floor_mib "$f") MiB floor" >&2; fail=1
    fi
  done
  if [ "$fail" -eq 0 ]; then
    sha256sum "$PAYLOAD" "$RENDERER" > SHA256SUMS
    echo
    echo "\`SHA256SUMS\` written next to the libs."
  fi
  echo
  return "$fail"
}

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

deep() {
  local dir="$1" sysroot="$2" api="$3" f m t n interp libdir stubs gaps count marker
  cd "$dir"
  libdir="$sysroot/usr/lib/aarch64-linux-android/$api"
  echo "### Static checks (bionic arm64, api-$api)"
  echo
  echo "| Check | File | Detail | |"
  echo "|---|---|---|---|"

  for f in "$PAYLOAD" "$RENDERER"; do
    m="$(readelf -hW "$f" | sed -n 's/^ *Machine: *//p')"
    t="$(readelf -hW "$f" | sed -n 's/^ *Type: *//p')"
    case "$m|$t" in
      "AArch64|DYN"*) row "ELF header" "\`$f\`" "$m, $t" OK ;;
      *) bad "ELF header" "\`$f\`" "$m, $t (want AArch64, DYN)" ;;
    esac
    n="$(needed "$f")"
    if [ -n "$n" ] && ! grep -qvxE 'lib(c|m|dl)\.so' <<<"$n"; then
      row "NEEDED system-only" "\`$f\`" "$(paste -sd' ' - <<<"$n")" OK
    else
      bad "NEEDED system-only" "\`$f\`" "$(paste -sd' ' - <<<"${n:-(none)}")"
    fi
  done

  interp="$(readelf -lW "$PAYLOAD" | sed -n 's/.*\[Requesting program interpreter: \(.*\)\]/\1/p')"
  if [ "$interp" = /system/bin/linker64 ]; then row "INTERP" "\`$PAYLOAD\`" "\`$interp\`" OK
  else bad "INTERP" "\`$PAYLOAD\`" "\`${interp:-(none)}\` (want /system/bin/linker64)"; fi

  # Embedded web UI + pair API + the OPENTUI_LIB_PATH override (driver step 3.5).
  for marker in auth/connect /api/pair wasm-unsafe-eval OPENTUI_LIB_PATH; do
    if grep -aqF -- "$marker" "$PAYLOAD"; then row "marker" "\`$PAYLOAD\`" "\`$marker\`" OK
    else bad "marker" "\`$PAYLOAD\`" "\`$marker\` not found"; fi
  done

  # Undefined-symbol scan: every non-weak undefined symbol must be defined by
  # the api-level stub of a NEEDED lib, or dlopen fails on device with
  # "cannot locate symbol" (how pthread_tryjoin_np was found).
  local report=""
  for f in "$RENDERER" "$PAYLOAD"; do
    stubs=()
    while IFS= read -r n; do
      if [ -f "$libdir/$n" ]; then stubs+=("$libdir/$n")
      else bad "symbol scan" "\`$f\`" "no api-$api stub for $n"; fi
    done < <(needed "$f")
    gaps="$(comm -23 <(dynsyms "$f" und) <(for s in "${stubs[@]}"; do dynsyms "$s" def; done | sort -u))"
    count="$(printf '%s' "$gaps" | grep -c . || true)"
    if [ "$count" -eq 0 ]; then
      row "symbol scan" "\`$f\`" "0 unresolved against api-$api stubs" OK
    elif [ "$f" = "$RENDERER" ]; then
      bad "symbol scan" "\`$f\`" "$count unresolved against api-$api stubs (below)"
    else
      # Bun's runtime targets its own API floor; informational only.
      row "symbol scan (info)" "\`$f\`" "$count unresolved against api-$api stubs (below)" INFO
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
  sums) sums "${2:?dir}" ;;
  deep) deep "${2:?dir}" "${3:?ndk sysroot}" "${4:?api}" ;;
  *) sed -n '2,15p' "$0" >&2; exit 2 ;;
esac
