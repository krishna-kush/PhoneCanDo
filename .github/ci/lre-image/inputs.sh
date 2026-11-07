#!/usr/bin/env bash
# Decide what this lre-image run builds and whether it publishes, once, so
# both builds of the job (the second proves reproducibility) and every later
# job use the same inputs even across midnight.
#
#   fresh    schedule, or workflow_dispatch with fresh=true: the newest
#            debian:trixie arm64 digest and today's snapshot; else pins.env
#   publish  only on prod: schedule, or workflow_dispatch with publish=true
#
# Usage: bash .github/ci/lre-image/inputs.sh
# Env: EVENT, REF (github.event_name, github.ref), IN_PUBLISH, IN_FRESH
#      (workflow_dispatch inputs, 'true'/'false'/empty)
# Writes DEBIAN_DIGEST and SNAPSHOT to $GITHUB_ENV (build.sh reads them),
# version/asset/sde/publish/fresh to $GITHUB_OUTPUT; markdown on stdout.
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/../../.."

fresh=false publish=false
case "${EVENT:?}" in
  schedule) fresh=true publish=true ;;
  workflow_dispatch)
    [ "${IN_FRESH:-false}" = true ] && fresh=true
    [ "${IN_PUBLISH:-false}" = true ] && publish=true
    ;;
esac
if [ "${REF:?}" != refs/heads/prod ]; then publish=false; fi

if $fresh; then
  resolved="$(bash lre/images/default/inputs.sh --fresh)"
else
  resolved="$(bash lre/images/default/inputs.sh)"
fi
while IFS='=' read -r key value; do
  printf -v "$key" '%s' "$value"
done <<<"$resolved"

asset="phonecando-linux-default-$VERSION-arm64.tar.xz"
if [ -n "${GITHUB_ENV:-}" ]; then
  printf 'DEBIAN_DIGEST=%s\nSNAPSHOT=%s\n' "$DEBIAN_DIGEST" "$SNAPSHOT" >> "$GITHUB_ENV"
fi
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  printf 'version=%s\nasset=%s\nsde=%s\npublish=%s\nfresh=%s\n' \
    "$VERSION" "$asset" "$SOURCE_DATE_EPOCH" "$publish" "$fresh" >> "$GITHUB_OUTPUT"
fi

echo "### Default env image inputs"
echo
echo "| Input | Value |"
echo "|---|---|"
echo "| version | \`$VERSION\` |"
echo "| debian:$DEBIAN_TAG (linux/arm64) | \`$DEBIAN_DIGEST\` |"
echo "| snapshot | \`$SNAPSHOT\` |"
echo "| recipe sha256 | \`$RECIPE_SHA256\` |"
echo "| source | $($fresh && echo 'fresh (newest upstream)' || echo 'pins.env') |"
echo "| publishes | $publish |"
echo
