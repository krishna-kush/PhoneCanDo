#!/usr/bin/env bash
# The Tier 3 compatibility table (lre-compat.yml): one row per planned
# image, from the result.json each leg wrote (leg.sh). A planned image with
# no result (its job died before the checks, or never ran) counts as failed.
#
# Usage: report.sh <matrix.json> <results-dir>
#   <matrix.json>  rotation.sh's matrix (a JSON list of {name, ref, ...})
#   <results-dir>  searched recursively for result.json files
# Env (optional): WEEK, RUN_URL (shown in the heading).
#   Markdown on stdout. With GITHUB_OUTPUT set, also writes failures=<n>.
#   Exit 0 whatever the legs did (Tier 3 reports, never blocks).
set -euo pipefail
export LC_ALL=C

MATRIX="${1:?usage: report.sh <matrix.json> <results-dir>}"
RESULTS="${2:?usage: report.sh <matrix.json> <results-dir>}"

results="$({ find "$RESULTS" -name result.json -type f -exec cat {} + 2>/dev/null || true; } | jq -cs .)"

table="$(jq -r --argjson results "$results" '
  def esc: gsub("\\|"; "\\|");
  def cell: if . == "" or . == null then "-" else "`\(. | esc)`" end;
  .[] as $leg
  | ([$results[] | select(.ref == $leg.ref)] | first) as $r
  | if $r == null then
      "| `\($leg.ref)` | `\($leg.family)` | - | - | **no result** | the job ended before the checks |"
    else
      "| `\($r.ref)` | `\($r.expectFamily)` | \($r.os | cell) | \($r.missingTools | cell) | "
      + (if $r.verdict == "pass" then "OK (\($r.passed))" else "**FAIL**" end) + " | "
      + (if ($r.failed | length) == 0 then "-" else ($r.failed | join(", ") | esc) end) + " |"
    end
' "$MATRIX")"

failures="$(jq -r --argjson results "$results" '
  [.[] as $leg | ([$results[] | select(.ref == $leg.ref)] | first) as $r
   | select($r == null or $r.verdict != "pass")] | length
' "$MATRIX")"
total="$(jq -r 'length' "$MATRIX")"

echo "### Linux image compatibility, Tier 3${WEEK:+ ($WEEK)}"
echo
echo "$failures of $total images failed${RUN_URL:+ in [this run]($RUN_URL)}. Tier 3 is report-only:" \
  "these images run through the same checks as Tier 2 (lre-compat.yml) but never block a release."
echo
echo "| Image | Family | OS | Missing tools | Result | Failed checks |"
echo "|---|---|---|---|---|---|"
[ -n "$table" ] && printf '%s\n' "$table"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "failures=$failures" >>"$GITHUB_OUTPUT"
fi
