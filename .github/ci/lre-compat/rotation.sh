#!/usr/bin/env bash
# Pick this week's Tier 3 images (lre-compat.yml) from tier3.txt,
# deterministically by ISO week: week W takes COUNT entries starting at
# ((W - 1) * COUNT) mod N, wrapping, so the whole list comes round every
# ceil(N / COUNT) weeks and a rerun in the same week picks the same images.
#
# Usage: rotation.sh <list-file> [rotation|all|none]
# Env (optional): WEEK (ISO week as YYYY-Www, default this week in UTC),
#   COUNT (default 4).
#   Markdown on stdout. With GITHUB_OUTPUT set, also writes matrix=<JSON
#   list of {name, ref, family, prep}>, count=<n> and week=<WEEK>.
set -euo pipefail
export LC_ALL=C

LIST="${1:?usage: rotation.sh <list-file> [rotation|all|none]}"
MODE="${2:-rotation}"
WEEK="${WEEK:-$(date -u +%G-W%V)}"
COUNT="${COUNT:-4}"

if [[ ! "$WEEK" =~ ^[0-9]{4}-W([0-9]{2})$ ]]; then
  echo "rotation: WEEK must look like 2026-W45, got '$WEEK'" >&2
  exit 1
fi
week_no=$((10#${BASH_REMATCH[1]}))
mapfile -t entries < <(grep -vE '^[[:space:]]*(#|$)' "$LIST")
n=${#entries[@]}
if [ "$n" -eq 0 ]; then
  echo "rotation: no images in $LIST" >&2
  exit 1
fi

picked=()
case "$MODE" in
  all) picked=("${entries[@]}") ;;
  none) ;;
  rotation)
    take=$((COUNT < n ? COUNT : n))
    first=$(((week_no - 1) * COUNT % n))
    for ((i = 0; i < take; i++)); do picked+=("${entries[(first + i) % n]}"); done
    ;;
  *)
    echo "rotation: mode must be rotation, all or none, got '$MODE'" >&2
    exit 1
    ;;
esac

matrix="$(
  for line in "${picked[@]}"; do
    read -r ref family prep <<<"$line"
    jq -cn --arg ref "$ref" --arg family "$family" --arg prep "${prep-}" \
      '{name: ($ref | gsub("[/:@]"; "-")), ref: $ref, family: $family, prep: $prep}'
  done | jq -cs .
)"

echo "### Tier 3 images for $WEEK ($MODE: ${#picked[@]} of $n)"
echo
if [ "${#picked[@]}" -gt 0 ]; then
  echo "| Image | Family | Prep |"
  echo "|---|---|---|"
  jq -r '.[] | "| `\(.ref)` | `\(.family)` | \(if .prep == "" then "-" else "`\(.prep)`" end) |"' <<<"$matrix"
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "matrix=$matrix"
    echo "count=${#picked[@]}"
    echo "week=$WEEK"
  } >>"$GITHUB_OUTPUT"
fi
