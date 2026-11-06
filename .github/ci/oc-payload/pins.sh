#!/usr/bin/env bash
# Pin consistency for the engine build. oc-payload.yml's workflow env, the defaults
# in scripts/agents/oc/build.sh and the docs a human follows must
# name the same versions, so a CI build and a local build are the same build.
# A bump edits all three; this names whichever one was missed. It also keeps the
# patch list honest: every scripts/agents/oc/patches/*.patch must be applied by
# the driver and known to upstream.sh (which tree it applies to).
# Env in (oc-payload.yml): OPENCODE_TAG OPENTUI_VERSION BUN_VERSION ZIG_VERSION
#                      NDK_VERSION ANDROID_API
# Usage (repo root): bash .github/ci/oc-payload/pins.sh
#   markdown table on stdout, exit 1 on any mismatch.
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/../../.."

: "${OPENCODE_TAG:?}" "${OPENTUI_VERSION:?}" "${BUN_VERSION:?}" "${ZIG_VERSION:?}" "${NDK_VERSION:?}" "${ANDROID_API:?}"

DRIVER=scripts/agents/oc/build.sh
DOCS=(docs/bootstrap/README.md docs/bootstrap/oc-build.md)
# Must match the patch → tree mapping in upstream.sh `check`.
KNOWN_PATCHES=(build-android-target.patch opentui-android-build.patch)
fail=0

row() { printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4"; }
same() { # <what> <oc-payload.yml value> <found value>
  if [ "$2" = "$3" ]; then row "$1" "\`$2\`" "\`$3\`" OK
  else row "$1" "\`$2\`" "\`${3:-(none)}\`" "**FAIL**"; fail=1; fi
}
has() { # <what> <file> <literal>
  if grep -qF -- "$3" "$2"; then row "$1" "\`$3\`" "$2" OK
  else row "$1" "\`$3\`" "not in $2" "**FAIL**"; fail=1; fi
}
# Value of `${NAME:-value}` in the driver (its default when env is unset).
default_of() {
  local pat="[\$]\\{$1:-[^}]*\\}"
  grep -oE "$pat" "$DRIVER" | head -n1 | sed -E 's/^[^:]*:-//; s/\}$//'
}

echo "### Pins (oc-payload.yml env ↔ driver defaults ↔ docs)"
echo
echo "| Pin | oc-payload.yml | Found | |"
echo "|---|---|---|---|"

same "driver BUN_VERSION default" "$BUN_VERSION" "$(default_of BUN_VERSION)"
same "driver OPENTUI_VERSION default" "$OPENTUI_VERSION" "$(default_of OPENTUI_VERSION)"
oc_default="$(default_of OPENCODE_VERSION)"   # e.g. 2.0.26-android-phonecando.1
same "driver OPENCODE_VERSION default (tag part)" "${OPENCODE_TAG#v}" "${oc_default%%-*}"
same "driver ANDROID_API default" "$ANDROID_API" "$(default_of ANDROID_API)"
has "driver toolchain note: Zig" "$DRIVER" "zig $ZIG_VERSION"

for doc in "${DOCS[@]}"; do
  has "clone tag" "$doc" "--branch $OPENCODE_TAG"
  has "Bun" "$doc" "Bun $BUN_VERSION"
  has "NDK" "$doc" "NDK $NDK_VERSION"
  has "Zig (major.minor)" "$doc" "Zig ${ZIG_VERSION%.*}"
done

for p in scripts/agents/oc/patches/*.patch; do
  name="${p##*/}"
  known=no
  for k in "${KNOWN_PATCHES[@]}"; do [ "$k" = "$name" ] && known=yes; done
  if [ "$known" = no ]; then
    row "patch known to CI" "\`$name\`" "new patch: teach .github/ci/oc-payload/upstream.sh its tree" "**FAIL**"; fail=1
  elif grep -qF -- "patches/$name" "$DRIVER"; then
    row "patch applied by driver" "\`$name\`" "$DRIVER" OK
  else
    row "patch applied by driver" "\`$name\`" "not referenced by $DRIVER" "**FAIL**"; fail=1
  fi
done

exit "$fail"
