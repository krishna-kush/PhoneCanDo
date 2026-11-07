#!/usr/bin/env bash
# shellcheck shell=bash
# Check helpers for leg.sh (sourced, not run on its own): markdown rows,
# collapsed logs, and the two ways the engine runs things in an image.
#
#   in_image CWD COMMAND     `$SHELL -c COMMAND` in CWD with run/engine.env,
#                            as opencode runs a shell command (lre-cli run)
#   on_path CWD PROG ARGS... PROG looked up on the engine's PATH, as opencode
#                            runs git and rg itself; PROG must resolve to a
#                            shim (never the runner's own git)
#   check NAME eq|re|last|ok WANT PROG ARGS...
#                            runs PROG; OK when it exits 0 and its output
#                            (stdout+stderr) equals WANT (eq), matches the
#                            regex WANT (re), ends with the line WANT (last),
#                            or whatever it prints (ok)
#   pass NAME SECS DETAIL    an OK row for a check run by hand
#   fail NAME SECS DETAIL [LOG]
#                            a FAIL row, LOG kept in a collapsed block
#   skip NAME WHY            a row for a check that does not apply
#
# Globals in: CLI, IMG, TIMEOUT (seconds per command; `TIMEOUT=n check ...`
# raises it for one check).
# Globals out: PASSED (count), FAILED (array of failed check names), LOGS
# (markdown), OUT and SECS of the last check.

PASSED=0
FAILED=()
LOGS=""
OUT=""
SECS=0
# The runner's own timeout: a bare `timeout` would hit shims/timeout (the
# guest's) once the engine's PATH is in place.
TIMEOUT_BIN="$(command -v timeout)"

oneline() { tr '\n' ' ' <<<"$1" | sed 's/ *$//; s/|/\\|/g' | cut -c1-90; }

in_image() {
  local cwd="$1" command="$2"
  "$CLI" run --image-dir "$IMG" --cwd "$cwd" --timeout "$TIMEOUT" -- "$command"
}

on_path() {
  local cwd="$1" exports
  shift
  exports="$("$CLI" env --image-dir "$IMG")" || return
  (
    eval "$exports"
    local found
    found="$(command -v "$1")"
    if [[ "$found" != "$IMG/shims/"* ]]; then
      echo "on_path: $1 resolves to '${found:-nothing}', not a shim under $IMG/shims"
      exit 127
    fi
    cd "$cwd" && "$TIMEOUT_BIN" "$TIMEOUT" "$@"
  )
}

row() { printf '| %s | %s | %ss | %s |\n' "$1" "$2" "$3" "$4"; }

pass() {
  PASSED=$((PASSED + 1))
  row "$1" OK "$2" "$3"
}

fail() {
  FAILED+=("$1")
  row "$1" "**FAIL**" "$2" "$3"
  if [ -n "${4-}" ]; then
    LOGS+=$'\n'"<details><summary>$1</summary>"$'\n\n```\n'"$(tail -n 60 <<<"$4")"$'\n```\n</details>\n'
  fi
  return 1
}

skip() { row "$1" "skipped" 0 "$2"; }

check() {
  local name="$1" mode="$2" want="$3" rc start pass=false
  shift 3
  start=$SECONDS
  OUT="$("$@" 2>&1)"
  rc=$?
  SECS=$((SECONDS - start))
  if [ "$rc" -eq 0 ]; then
    case "$mode" in
      eq) [ "$OUT" = "$want" ] && pass=true ;;
      re) [[ "$OUT" =~ $want ]] && pass=true ;;
      last) [ "${OUT##*$'\n'}" = "$want" ] && pass=true ;;
      ok) pass=true ;;
    esac
  fi
  if $pass; then
    local shown="$OUT"
    # A package manager's run says what it did on its last line.
    [ "$mode" = ok ] && shown="${OUT##*$'\n'}"
    # shellcheck disable=SC2016 # the backticks are markdown
    pass "$name" "$SECS" "\`$(oneline "${shown:--}")\`"
    return 0
  fi
  fail "$name" "$SECS" "exit $rc" "$OUT"$'\n'"wanted ($mode): $want"
}
