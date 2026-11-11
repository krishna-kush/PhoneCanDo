#!/usr/bin/env bash
# Our suggested models (lme catalog's suggested.json, read by the app and the
# website) are still on the Hugging Face Hub as pinned: one HEAD per file at
# its pinned revision, no redirect followed, no token (every suggestion is
# public). The Hub answers a file with its commit (x-repo-commit) and, for an
# LFS file, its size and sha256 (x-linked-size, x-linked-etag); each must
# equal the pin. A file served straight (200) falls back to content-length
# and etag; a file the Hub gives no sha256 for fails, as we cannot check it.
# A 429 waits as long as the Hub asks (Retry-After, else its RateLimit
# window) and tries again, as does a 5xx or a failed connection.
#
# Usage: check-pins.sh [suggested.json]
#   One line per file on stdout (OK or FAIL); exit 1 when any file fails.
set -euo pipefail
export LC_ALL=C

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LIST="${1:-$ROOT/lme/catalog/src/main/resources/com/phonecando/lme/catalog/suggested/suggested.json}"
TRIES=4 # the first and three more

HDRS="$(mktemp)"
ERR="$(mktemp)"
trap 'rm -f "$HDRS" "$ERR"' EXIT

# One response header's value from $HDRS (empty when it is missing).
header() {
  awk -v name="$1" 'index(tolower($0), name ":") == 1 {
    sub(/^[^:]*:[ \t]*/, ""); sub(/[ \t\r]+$/, ""); print; exit }' "$HDRS"
}

# HEAD of $1 into $HDRS; sets STATUS (000 when curl got no answer).
head_file() {
  local try delay
  for ((try = 1; try <= TRIES; try++)); do
    : >"$HDRS"
    STATUS="$(curl -sS -I --connect-timeout 20 --max-time 60 -o /dev/null -D "$HDRS" \
      -w '%{http_code}' "$1" </dev/null 2>"$ERR")" || STATUS=000
    case "$STATUS" in 429 | 5?? | 000) ;; *) return ;; esac
    ((try < TRIES)) || return
    if [ "$STATUS" = 429 ]; then
      delay="$(header retry-after)"
      [[ $delay =~ ^[0-9]+$ ]] || delay="$(header ratelimit | sed -n 's/.*;t=\([0-9]*\).*/\1/p')"
      [[ $delay =~ ^[0-9]+$ ]] || delay=$((30 * try))
      ((delay <= 300)) || delay=300
    else
      delay=$((10 * try))
    fi
    echo "  $STATUS for $1, trying again in ${delay}s" >&2
    sleep "$delay"
  done
}

# One line per file, fields split by the unit separator (a tab would fold
# an empty field into the next).
entries="$(jq -r '(.models // [])[] | [.repo, .revision, .file.path,
  (.file.path // "" | split("/") | map(@uri) | join("/")),
  .file.sizeBytes, .file.sha256] | map(. // "" | tostring) | join("\u001f")' "$LIST")"
[ -n "$entries" ] || { echo "FAIL $LIST: no models"; exit 1; }

fail=0
while IFS=$'\x1f' read -r repo revision path urlpath size sha; do
  what="$repo $path @ ${revision:0:7}"
  diffs=()
  if [ -z "$repo" ] || [ -z "$path" ]; then
    diffs+=("pinned repo or file path is missing")
  elif ! [[ $revision =~ ^[0-9a-f]{40}$ ]]; then
    diffs+=("pinned revision '$revision' is not a full commit id")
  elif ! [[ $sha =~ ^[0-9a-f]{64}$ ]]; then
    diffs+=("pinned sha256 '$sha' is not 64 hex digits")
  elif ! [[ $size =~ ^[0-9]+$ ]]; then
    diffs+=("pinned size '$size' is not a byte count")
  else
    head_file "https://huggingface.co/$repo/resolve/$revision/$urlpath"
    case "$STATUS" in
      200 | 302 | 307)
        commit="$(header x-repo-commit)"
        got_size="$(header x-linked-size)"
        etag="$(header x-linked-etag)"
        if [ "$STATUS" = 200 ]; then
          [ -n "$got_size" ] || got_size="$(header content-length)"
          [ -n "$etag" ] || etag="$(header etag)"
        fi
        etag="${etag#W/}"
        etag="${etag//\"/}"
        [ "$commit" = "$revision" ] || diffs+=("commit: pinned $revision, Hub ${commit:-names none}")
        [ "$got_size" = "$size" ] || diffs+=("size: pinned $size, Hub ${got_size:-gives none}")
        if [[ $etag =~ ^[0-9a-f]{64}$ ]]; then
          [ "$etag" = "$sha" ] || diffs+=("sha256: pinned $sha, Hub $etag")
        else
          diffs+=("sha256: Hub gives none (etag '${etag}'; not an LFS file?)")
        fi
        ;;
      000)
        err="$(tail -n 1 "$ERR")"
        diffs+=("no answer from the Hub (${err:-curl failed})")
        ;;
      *)
        code="$(header x-error-code)"
        msg="$(header x-error-message)"
        hint=""
        case "$STATUS" in
          401 | 403) hint=" (repository gone, private or gated)" ;;
          404) hint=" (no such file at this revision, or no such revision)" ;;
        esac
        diffs+=("HTTP $STATUS${code:+ $code}${msg:+: $msg}$hint")
        ;;
    esac
  fi
  if [ "${#diffs[@]}" -eq 0 ]; then
    echo "OK   $what: $size bytes, sha256 ${sha:0:12}"
  else
    fail=1
    joined="$(printf '%s; ' "${diffs[@]}")"
    echo "FAIL $what: ${joined%; }"
  fi
done <<<"$entries"
exit "$fail"
