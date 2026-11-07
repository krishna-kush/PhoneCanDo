#!/bin/sh
# Builds and runs the host test of the pty core (plain C, no JNI) on Linux,
# twice: as shipped, and with the close_range syscall off so the fallback
# close loop is covered too. Needs a C compiler (CC, default cc) and /proc.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
core="$here/../../main/cpp/pty"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

for variant in close-range no-close-range; do
  flags=""
  if [ "$variant" = no-close-range ]; then flags="-DPTY_TEST_NO_CLOSE_RANGE"; fi
  # shellcheck disable=SC2086
  "${CC:-cc}" -std=gnu11 -O1 -g -Wall -Wextra -Werror $flags -I"$core" \
    "$here"/*.c "$core"/*.c -o "$out/pty_test"
  echo "== $variant"
  "$out/pty_test"
done
