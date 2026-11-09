#!/usr/bin/env bash
# opencode's leg of agent-payload.yml's drift job (weekly and on demand; an
# early warning, not a gate): does the newest upstream opencode tag, with the
# opentui it pins, still fit our patches and build? The pinned build is
# unaffected either way.
# Usage: bash agents/native/opencode/ci/drift.sh
#   markdown on stdout (the workflow adds it to the job summary); exit 1 when
#   the newest tag needs work before a bump.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../build/pins.env
. "$here/../build/pins.env"

latest="$(bash "$here/upstream.sh" latest-tag https://github.com/anomalyco/opencode.git)"
if [ -z "$latest" ]; then
  echo "::error::no vX.Y.Z tags found on anomalyco/opencode" >&2
  exit 1
fi
echo "### Upstream drift"
echo
echo "Pinned \`$OPENCODE_TAG\`; newest upstream tag \`$latest\`."
echo
if [ "$latest" = "$OPENCODE_TAG" ]; then
  echo "The pin is the newest tag; the check job covers it."
  exit 0
fi

tmp="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/oc-drift.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
git -c advice.detachedHead=false clone -q --depth 1 --branch "$latest" \
  https://github.com/anomalyco/opencode.git "$tmp/opencode"
pin="$(bash "$here/upstream.sh" opentui-pin "$tmp/opencode")"
if [[ ! "$pin" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+.][0-9A-Za-z.-]+)?$ ]]; then
  echo "::error::unexpected @opentui/core pin in $latest: $pin" >&2
  exit 1
fi
if ! git -c advice.detachedHead=false clone -q --depth 1 --branch "v$pin" \
     https://github.com/anomalyco/opentui.git "$tmp/opentui"; then
  echo "\`$latest\` pins @opentui/core \`$pin\`, but anomalyco/opentui has no \`v$pin\` tag."
  exit 1
fi

echo "#### opencode \`$latest\`, opentui \`v$pin\`"
echo
echo "DRIFT rows are pins a bump to this tag would move; FAIL rows need work first."
echo
bash "$here/upstream.sh" check report "$tmp/opencode" "$tmp/opentui"
