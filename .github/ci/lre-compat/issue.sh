#!/usr/bin/env bash
# Open or update the ONE issue "Linux image compatibility report" with a
# Tier 3 table (report.sh's markdown): the open issue with exactly that
# title gets the new table as its body and a one-line comment (so people
# watching it hear of the new run); with none open, a new one is created.
# CI only (lre-compat.yml's tier3-report job, which alone has issues: write).
#
# Usage: issue.sh <report.md>
# Env: GH_TOKEN, GH_REPO (owner/name), RUN_URL; WEEK (optional).
#   The issue URL on stdout.
set -euo pipefail

REPORT="${1:?usage: issue.sh <report.md>}"
: "${GH_TOKEN:?GH_TOKEN is required}" "${GH_REPO:?GH_REPO is required}" "${RUN_URL:?RUN_URL is required}"
TITLE="Linux image compatibility report"

body="$(mktemp)"
trap 'rm -f -- "$body"' EXIT
{
  cat "$REPORT"
  echo
  echo "Written by lre-compat.yml's tier3-report job; it updates this issue while Tier 3 images fail" \
    "and opens a new one when none is open. Each leg's own table, with logs, is in the run's summary."
} >"$body"

number="$(gh issue list --repo "$GH_REPO" --state open --search "\"$TITLE\" in:title" \
  --json number,title --jq "[.[] | select(.title == \"$TITLE\")] | first | .number // empty")"

if [ -n "$number" ]; then
  gh issue edit "$number" --repo "$GH_REPO" --body-file "$body" >/dev/null
  gh issue comment "$number" --repo "$GH_REPO" \
    --body "Tier 3 failed again${WEEK:+ in $WEEK}: $RUN_URL (table above updated)." >/dev/null
  echo "${GITHUB_SERVER_URL:-https://github.com}/$GH_REPO/issues/$number"
else
  gh issue create --repo "$GH_REPO" --title "$TITLE" --body-file "$body"
fi
