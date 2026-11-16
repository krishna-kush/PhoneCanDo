#!/usr/bin/env bash
# Stages the llama-server a release ships: the newest green llamacpp.yml build
# on prod whose INPUTS (the digest lme/llamacpp/build.sh writes of its pins,
# build script and patches) equals this tree's, through lme/llamacpp/stage.sh,
# which checks its SHA256SUMS. CI keeps those builds 14 days; with none
# matching it stops and says to run llamacpp.yml.
#
# Usage: .github/ci/release/stage-llama-server.sh <work-dir>
# Env: GH_TOKEN (actions: read), GITHUB_REPOSITORY (owner/repo).
set -euo pipefail
work="${1:?usage: stage-llama-server.sh <work-dir>}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"
want="$(cd lme/llamacpp && sha256sum pins.env build.sh patches/*.patch | sha256sum | cut -d' ' -f1)"
echo "llama-server: looking for a llamacpp.yml build of INPUTS $want"

runs="$(gh run list -R "$repo" --workflow llamacpp.yml --branch prod --status success --limit 10 \
  --json databaseId -q '.[].databaseId')"
for id in $runs; do
  dir="$work/llamacpp-$id"
  if ! gh run download "$id" -R "$repo" -n llamacpp-android-arm64 -D "$dir" > /dev/null 2>&1; then
    continue # its artifact expired
  fi
  if [ "$(cat "$dir/INPUTS" 2>/dev/null)" = "$want" ]; then
    bash lme/llamacpp/stage.sh "$dir"
    echo "llama-server: **staged from llamacpp.yml run $id**" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    exit 0
  fi
  rm -rf "$dir"
done
echo "::error title=No llama-server build::no green llamacpp.yml run on prod in the last 14 days built INPUTS $want; run llamacpp.yml on prod, then release again"
exit 1
