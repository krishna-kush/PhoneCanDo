#!/usr/bin/env bash
# Prove the toolchain the setup-* actions installed is the one engine.yml pins,
# and that the host tools the driver and upstream build.ts shell out to exist,
# before an hour goes into the build.
# Usage: check-toolchain.sh <ndk-root>    (zig and bun on PATH)
# Env in (engine.yml): NDK_VERSION ZIG_VERSION BUN_VERSION ANDROID_API
#   markdown table on stdout, exit 1 on any mismatch.
set -euo pipefail

ndk="${1:?usage: check-toolchain.sh <ndk-root>}"
: "${NDK_VERSION:?}" "${ZIG_VERSION:?}" "${BUN_VERSION:?}" "${ANDROID_API:?}"
fail=0
row() { printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4"; }
same() { # <what> <want> <got>
  if [ "$2" = "$3" ]; then row "$1" "\`$2\`" "\`$3\`" OK
  else row "$1" "\`$2\`" "\`${3:-(none)}\`" "**FAIL**"; fail=1; fi
}

echo "### Toolchain"
echo
echo "| Tool | Pinned | Found | |"
echo "|---|---|---|---|"

# NDK rNN<letter> ships as Pkg.Revision NN.<letter index>.<build>
# (r28 → 28.0.x, r28b → 28.1.x, r28c → 28.2.x).
num="${NDK_VERSION#r}"
major="${num%%[a-z]*}"
letter="${num#"$major"}"
minor=0
if [ -n "$letter" ]; then minor=$(( $(printf '%d' "'$letter") - 97 )); fi
rev="$(sed -n 's/^Pkg\.Revision *= *//p' "$ndk/source.properties" 2>/dev/null | tr -d '\r')"
case "$rev" in
  "$major.$minor".*) row "NDK $NDK_VERSION" "\`$major.$minor.*\`" "\`$rev\`" OK ;;
  *) row "NDK $NDK_VERSION" "\`$major.$minor.*\`" "\`${rev:-(none)}\`" "**FAIL**"; fail=1 ;;
esac
# The driver and opentui's patched build.zig hardcode prebuilt/linux-x86_64.
stubs="$ndk/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/aarch64-linux-android/$ANDROID_API"
if [ -f "$stubs/libc.so" ]; then
  row "NDK api-$ANDROID_API stubs" "linux-x86_64 sysroot" present OK
else
  row "NDK api-$ANDROID_API stubs" "linux-x86_64 sysroot" "missing: $stubs" "**FAIL**"; fail=1
fi

same "Zig" "$ZIG_VERSION" "$(zig version 2>/dev/null || true)"
same "Bun" "$BUN_VERSION" "$(bun --version 2>/dev/null || true)"

# git/python3 (driver), readelf (stage-v2.sh), unzip (build.ts unpacks the
# bun cross-compile runtime), file/sha256sum (verify-payload.sh), jq.
missing=""
for t in git python3 readelf unzip file sha256sum jq; do
  command -v "$t" >/dev/null || missing+=" $t"
done
if [ -z "$missing" ]; then row "host tools" "git python3 readelf unzip file sha256sum jq" present OK
else row "host tools" "git python3 readelf unzip file sha256sum jq" "missing:$missing" "**FAIL**"; fail=1; fi
echo

exit "$fail"
