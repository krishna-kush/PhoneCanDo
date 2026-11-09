#!/usr/bin/env bash
# Plan lre-compat.yml's blocking legs from tier2.txt: the tier2 legs (one per
# image) and the agents legs, one per runtime plugin x Tier 2 image whose
# family the runtime claims (runtime.json `families`).
#
# Usage: agent-plan.sh <tier2.txt> <runtimes-dir>
#   <runtimes-dir>  agents/runtimes: every <id>/runtime.json in it
#   Markdown on stdout. With GITHUB_OUTPUT set, also writes
#   tier2=<JSON list of {name, ref, family, prep}> and
#   agents=<JSON list of {name, runtime, ref, family}>. Exit 1 when either
#   list is empty: we always ship a runtime, and an empty matrix is an error.
set -euo pipefail
export LC_ALL=C

usage="usage: agent-plan.sh <tier2.txt> <runtimes-dir>"
LIST="${1:?$usage}"
RUNTIMES="${2:?$usage}"

tier2="$(
  grep -vE '^[[:space:]]*(#|$)' "$LIST" | while read -r ref family prep; do
    jq -cn --arg ref "$ref" --arg family "$family" --arg prep "${prep-}" \
      '{name: ($ref | gsub("[/:@]"; "-")), ref: $ref, family: $family, prep: $prep}'
  done | jq -cs .
)"

shopt -s nullglob
plugins=("$RUNTIMES"/*/runtime.json)
runtimes="$(
  for f in "${plugins[@]}"; do
    jq -c '{id, families}' "$f"
  done | jq -cs .
)"

agents="$(jq -cn --argjson images "$tier2" --argjson runtimes "$runtimes" '
  [$runtimes[] as $r | $images[] | select(.family as $f | $r.families | index($f))
   | {name: "\($r.id)-\(.name)", runtime: $r.id, ref, family}]')"

echo "### Tier 2 images and agent legs"
echo
echo "| Image | Family | Runtimes |"
echo "|---|---|---|"
jq -r --argjson agents "$agents" '.[] | . as $i
  | [$agents[] | select(.ref == $i.ref) | .runtime] as $r
  | "| `\(.ref)` | `\(.family)` | \(if $r == [] then "-" else ($r | join(", ")) end) |"' <<<"$tier2"

if [ "$(jq length <<<"$tier2")" -eq 0 ]; then
  echo "agent-plan: no images in $LIST" >&2
  exit 1
fi
if [ "$(jq length <<<"$agents")" -eq 0 ]; then
  echo "agent-plan: no runtime in $RUNTIMES claims a Tier 2 family" >&2
  exit 1
fi

if [ -n "${GITHUB_OUTPUT-}" ]; then
  {
    echo "tier2=$tier2"
    echo "agents=$agents"
  } >>"$GITHUB_OUTPUT"
fi
