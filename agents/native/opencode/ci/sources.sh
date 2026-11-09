#!/usr/bin/env bash
# Clone the pinned upstream trees where build.sh looks for them (its default
# OPENCODE_WORKTREE and OPENTUI_SRC under <workdir>) and prove both patches
# apply. The trees are fresh, so both must: build.sh reads a failed
# `apply --check` as "already applied" and carries on, which here would only
# surface much later as a confusing build error.
# Usage: bash agents/native/opencode/ci/sources.sh <workdir>
#   markdown sources table on stdout; exit 1 when a clone or patch fails.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="${1:?usage: sources.sh <workdir>}"
# shellcheck source=../build/pins.env
. "$here/../build/pins.env"

oc="$work/oc-v2"                      # build.sh default OPENCODE_WORKTREE
ot="$work/opentui-$OPENTUI_VERSION"   # build.sh default OPENTUI_SRC
git -c advice.detachedHead=false clone -q --depth 1 --branch "$OPENCODE_TAG" \
  https://github.com/anomalyco/opencode.git "$oc"
git -c advice.detachedHead=false clone -q --depth 1 --branch "v$OPENTUI_VERSION" \
  https://github.com/anomalyco/opentui.git "$ot"
git -C "$oc" apply --check "$here/../build/patches/build-android-target.patch"
git -C "$ot" apply --check "$here/../build/patches/opentui-android-build.patch"
oc_sha="$(git -C "$oc" rev-parse HEAD)"
ot_sha="$(git -C "$ot" rev-parse HEAD)"

echo "### Sources"
echo
echo "| Tree | Ref | Commit |"
echo "|---|---|---|"
echo "| anomalyco/opencode | \`$OPENCODE_TAG\` | \`$oc_sha\` |"
echo "| anomalyco/opentui | \`v$OPENTUI_VERSION\` | \`$ot_sha\` |"
echo
