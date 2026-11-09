#!/usr/bin/env bash
# __ID__'s leg of agent-payload.yml's check job: do our pins and patches
# still fit the pinned upstream source? Runs on every change to the kind.
# Usage: bash agents/native/__ID__/ci/check.sh
#   markdown on stdout (the workflow adds it to the job summary); exit 1 on
#   any failure.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../build/pins.env
. "$here/../build/pins.env"

echo "### __ID__: upstream contract"
echo
echo "TODO: check the pins in build/pins.env (NDK $NDK_VERSION, api-$ANDROID_API) against upstream."
exit 1
