#!/usr/bin/env bash
# opencode's leg of agent-payload.yml's check job: do our pins and patches
# still fit the pinned upstream tags? Each part reports even when an earlier
# one failed:
#   1. pins.sh: pins.env ↔ agent.json ↔ docs, and the patch list;
#   2. clone anomalyco/opencode at OPENCODE_TAG and anomalyco/opentui at
#      v$OPENTUI_VERSION;
#   3. upstream.sh check strict on both trees (patches, pins, anchor, pair
#      API, theme).
# Usage: bash agents/native/opencode/ci/check.sh
#   markdown on stdout (the workflow adds it to the job summary); exit 1 on
#   any failure.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../build/pins.env
. "$here/../build/pins.env"
fail=0

bash "$here/pins.sh" || fail=1
echo

tmp="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/oc-check.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
if git -c advice.detachedHead=false clone -q --depth 1 --branch "$OPENCODE_TAG" \
     https://github.com/anomalyco/opencode.git "$tmp/opencode" \
   && git -c advice.detachedHead=false clone -q --depth 1 --branch "v$OPENTUI_VERSION" \
     https://github.com/anomalyco/opentui.git "$tmp/opentui"; then
  echo "### Upstream contract: opencode \`$OPENCODE_TAG\`, opentui \`v$OPENTUI_VERSION\`"
  echo
  bash "$here/upstream.sh" check strict "$tmp/opencode" "$tmp/opentui" || fail=1
else
  echo "::error::could not clone opencode $OPENCODE_TAG or opentui v$OPENTUI_VERSION" >&2
  fail=1
fi

exit "$fail"
