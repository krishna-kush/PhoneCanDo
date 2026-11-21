#!/usr/bin/env bash
# Clone the pinned upstream trees where build.sh looks for them (its default
# OPENCODE_WORKTREE and OPENTUI_SRC under <workdir>), prove each is the commit
# ci/commits.env pins (a tag can be moved upstream) and that every patch
# applies. The trees are fresh, so each must: build.sh reads a failed
# `apply --check` of the android patches as "already applied" and carries on,
# which here would only surface much later as a confusing build error.
# Usage: bash agents/native/opencode/ci/sources.sh <workdir>
#   markdown sources table on stdout; exit 1 when a clone or patch fails.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="${1:?usage: sources.sh <workdir>}"
# shellcheck source=../build/pins.env
. "$here/../build/pins.env"
# shellcheck source=commits.env
. "$here/commits.env"

oc="$work/oc-v2"                      # build.sh default OPENCODE_WORKTREE
ot="$work/opentui-$OPENTUI_VERSION"   # build.sh default OPENTUI_SRC
git -c advice.detachedHead=false clone -q --depth 1 --branch "$OPENCODE_TAG" \
  https://github.com/anomalyco/opencode.git "$oc"
git -c advice.detachedHead=false clone -q --depth 1 --branch "v$OPENTUI_VERSION" \
  https://github.com/anomalyco/opentui.git "$ot"
oc_sha="$(git -C "$oc" rev-parse HEAD)"
ot_sha="$(git -C "$ot" rev-parse HEAD)"
pinned() { # <tree> <tag> <found> <pinned>
  if [ "$3" != "$4" ]; then
    echo "::error title=Upstream tag moved::$1 $2 is now $3, not the pinned $4 (ci/commits.env); nothing is built from it" >&2
    exit 1
  fi
}
pinned anomalyco/opencode "$OPENCODE_TAG" "$oc_sha" "$OPENCODE_COMMIT"
pinned anomalyco/opentui "v$OPENTUI_VERSION" "$ot_sha" "$OPENTUI_COMMIT"
git -C "$oc" apply --check "$here/../build/patches/build-android-target.patch"
git -C "$oc" apply --check "$here/../build/patches/phonecando-brand.patch"
git -C "$ot" apply --check "$here/../build/patches/opentui-android-build.patch"

echo "### Sources"
echo
echo "| Tree | Ref | Commit |"
echo "|---|---|---|"
echo "| anomalyco/opencode | \`$OPENCODE_TAG\` | \`$oc_sha\` |"
echo "| anomalyco/opentui | \`v$OPENTUI_VERSION\` | \`$ot_sha\` |"
echo
