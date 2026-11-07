#!/usr/bin/env bash
# Build what every lre-compat leg runs, for this host (CI: ubuntu-24.04-arm):
#
#   lib/  libproot.so + libproot-loader.so (lre/proot/build-glibc.sh) and
#         our launcher libphonecando_launch.so (lre/launcher, gcc, the flags
#         of its host tests): the APK's native-lib dir, same file names
#   cli/  lre-cli's install tree (lre/cli/build/install/cli, from Gradle's
#         :cli:installDist, which must have run first)
#
# packed as one tarball, so the exec bits survive the artifact zip.
#
# Usage: payload.sh <workdir> <out.tar.gz>
#   <workdir>  build trees and the payload/ tree; payload/ is rebuilt
# Env: CC (default gcc). Markdown on stdout (files, sizes, sha256); the
# proot build log goes to stderr.
set -euo pipefail
export LC_ALL=C

usage="usage: payload.sh <workdir> <out.tar.gz>"
WORK="${1:?$usage}"
OUT="${2:?$usage}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLI_TREE="$REPO/lre/cli/build/install/cli"

if [ ! -x "$CLI_TREE/bin/cli" ]; then
  echo "payload: $CLI_TREE/bin/cli is missing; run ./gradlew :cli:installDist in lre/ first" >&2
  exit 1
fi
mkdir -p "$WORK" "$(dirname "$OUT")"
WORK="$(cd "$WORK" && pwd -P)"
PAYLOAD="$WORK/payload"
rm -rf "$PAYLOAD"
mkdir -p "$PAYLOAD/lib"

bash "$REPO/lre/proot/build-glibc.sh" "$WORK/proot-work" "$PAYLOAD/lib" >&2
"${CC:-gcc}" -std=c11 -O2 -Wall -Wextra -Werror -o "$PAYLOAD/lib/libphonecando_launch.so" \
  "$REPO/lre/launcher/src/conf.c" "$REPO/lre/launcher/src/plan.c" "$REPO/lre/launcher/src/main.c"
cp -R "$CLI_TREE" "$PAYLOAD/cli"
tar -C "$PAYLOAD" -czf "$OUT" lib cli

echo "### lre-compat payload ($(uname -m))"
echo
echo "| File | Bytes | sha256 |"
echo "|---|---|---|"
(
  cd "$PAYLOAD"
  for f in lib/libproot.so lib/libproot-loader.so lib/libphonecando_launch.so cli/lib/cli-*.jar; do
    # shellcheck disable=SC2016 # the backticks are markdown
    printf '| `%s` | %s | `%s` |\n' "$f" "$(stat -c %s "$f")" "$(sha256sum "$f" | cut -c1-16)…"
  done
)
version="$("$PAYLOAD/lib/libproot.so" -V 2>&1 || true)"
echo
echo "proot \`$(grep -m1 -o '[0-9]\+\(\.[0-9]\+\)\+' <<<"$version" || echo '?')\`," \
  "packed as \`$(basename "$OUT")\` ($(stat -c %s "$OUT") bytes)."
