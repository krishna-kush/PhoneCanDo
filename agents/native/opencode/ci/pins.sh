#!/usr/bin/env bash
# Pin and patch honesty for the opencode payload build. build/pins.env is the
# one source of the pins (build.sh and agent-payload.yml read it); agent.json's
# version and the docs a human follows must name the same versions, so a CI
# build and a local build are the same build. A bump edits pins.env, agent.json
# and the docs; this names whichever was missed. It also keeps the patch list
# honest: every build/patches/*.patch must be applied by build.sh and known to
# upstream.sh (which tree it applies to).
# Usage: bash agents/native/opencode/ci/pins.sh
#   markdown table on stdout, exit 1 on any mismatch.
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/.."

PINS=build/pins.env
DRIVER=build/build.sh
DOCS=(docs/README.md docs/build.md)
# Must match the patch → tree mapping in upstream.sh `check`.
KNOWN_PATCHES=(build-android-target.patch opentui-android-build.patch)
REQUIRED=(OPENCODE_TAG OPENCODE_VERSION OPENCODE_CHANNEL OPENTUI_VERSION BUN_VERSION ZIG_VERSION NDK_VERSION ANDROID_API)
fail=0

row() { printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4"; }
same() { # <what> <pins.env value> <found value>
  if [ "$2" = "$3" ]; then row "$1" "\`$2\`" "\`$3\`" OK
  else row "$1" "\`$2\`" "\`${3:-(none)}\`" "**FAIL**"; fail=1; fi
}
has() { # <what> <file> <literal>
  if grep -qF -- "$3" "$2"; then row "$1" "\`$3\`" "$2" OK
  else row "$1" "\`$3\`" "not in $2" "**FAIL**"; fail=1; fi
}

echo "### Pins (pins.env ↔ agent.json ↔ docs)"
echo
echo "| Pin | pins.env | Found | |"
echo "|---|---|---|---|"

# The same file is read as shell (build.sh) and as an Actions env file
# (agent-payload.yml), so only plain KEY=value lines are safe in both.
while IFS= read -r line; do
  case "$line" in '' | '#'*) continue ;; esac
  if [[ ! "$line" =~ ^[A-Z][A-Z0-9_]*=[^[:space:]\"\'\#\$\`]+$ ]]; then
    row "$PINS line" "\`$line\`" "not a plain KEY=value line" "**FAIL**"; fail=1
  fi
done < "$PINS"
if [ "$fail" -ne 0 ]; then exit "$fail"; fi
# shellcheck source=../build/pins.env
. "$PINS"
for key in "${REQUIRED[@]}"; do
  if [ -z "${!key:-}" ]; then row "$PINS" "\`$key\`" "missing" "**FAIL**"; fail=1; fi
done
if [ "$fail" -ne 0 ]; then exit "$fail"; fi

same "OPENCODE_VERSION (tag part)" "${OPENCODE_TAG#v}" "${OPENCODE_VERSION%%-*}"
same "agent.json version" "$OPENCODE_VERSION" "$(jq -r '.version // empty' agent.json)"

for doc in "${DOCS[@]}"; do
  has "clone tag" "$doc" "--branch $OPENCODE_TAG"
  has "Bun" "$doc" "Bun $BUN_VERSION"
  has "NDK" "$doc" "NDK $NDK_VERSION"
  has "Zig (major.minor)" "$doc" "Zig ${ZIG_VERSION%.*}"
done

for p in build/patches/*.patch; do
  name="${p##*/}"
  known=no
  for k in "${KNOWN_PATCHES[@]}"; do [ "$k" = "$name" ] && known=yes; done
  if [ "$known" = no ]; then
    row "patch known to CI" "\`$name\`" "new patch: teach ci/upstream.sh its tree" "**FAIL**"; fail=1
  elif grep -qF -- "patches/$name" "$DRIVER"; then
    row "patch applied by build.sh" "\`$name\`" "$DRIVER" OK
  else
    row "patch applied by build.sh" "\`$name\`" "not referenced by $DRIVER" "**FAIL**"; fail=1
  fi
done

exit "$fail"
