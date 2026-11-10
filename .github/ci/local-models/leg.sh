#!/usr/bin/env bash
# One leg of local-models.yml: a kind with a `models` block, installed into
# a fresh machine as the phone installs it, then run in its one-shot mode
# (one-shot.json) against our llama-server once per test model
# (models.json), the server started as lme's launch plan starts it.
#
#   machine   the machine image (Dockerfile) with --network host: the server
#             listens on the runner's loopback, as on the phone
#   install   an image kind: kit-cli render-install --family apt, run with
#             sh in the machine (HOME /root) as the phone's install job runs
#             it; a native kind: its ci/host-engine.sh puts a Linux build of
#             its engine in the lib dir
#   per model
#     serve   lme-cli plan (LlamaCppRuntime's argv, context and endpoint),
#             the plan's argv with the key in LLAMA_API_KEY, up on /health
#     render  kit-cli render-model with the plan's endpoint: the one-shot
#             argv, env, cwd and PATH, guest side, the key by reference
#     run     that in the machine; OK on exit 0, some output on stdout and
#             at least one answer the server finished during the run (its
#             log's `eval time` line). Exit 0 and output alone are not
#             enough: kinds print banners, and some (Aider) exit 0 after
#             giving up on the server. The check proves the wiring, not the
#             model: whether the reply holds the word the prompt asks for
#             (EXPECT; a tiny model often talks around it) is only noted
#
# The key is random per leg, lives in this script's environment and reaches
# the server and the machine through the environment and a 0600 env file,
# never a command line or the output.
#
# Usage: leg.sh <kind-id> <kit-cli-dir> <lme-cli-dir> <llama-server> <models-dir> <scratch>
#   <kit-cli-dir>, <lme-cli-dir>  their installDist trees
#   <models-dir>   the files models.json names (fetch-models.sh)
# Env: MACHINE (image tag, default phonecando-local-models), MODELS (the
#   list, default models.json beside this script), RUN_TIMEOUT
#   (seconds per one-shot run, default 1800), CONTEXT (the served context,
#   default 65536), PROMPT and EXPECT (an ERE noted when the reply on stdout
#   matches it, case-insensitive).
# Markdown on stdout, <scratch>/results.jsonl one line per model, exit 1 on
# any FAIL. Needs docker, jq, curl and java.
set -uo pipefail
export LC_ALL=C

usage="usage: leg.sh <kind-id> <kit-cli-dir> <lme-cli-dir> <llama-server> <models-dir> <scratch>"
KIND_ID="${1:?$usage}"
KIT_CLI="$(cd "${2:?$usage}" && pwd -P)/bin/kit-cli" || exit 2
LME_CLI="$(cd "${3:?$usage}" && pwd -P)/bin/lme-cli" || exit 2
SERVER="$(cd "$(dirname "${4:?$usage}")" && pwd -P)/$(basename "$4")" || exit 2
MODELS_DIR="$(cd "${5:?$usage}" && pwd -P)" || exit 2
SCRATCH="${6:?$usage}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
MACHINE="${MACHINE:-phonecando-local-models}"
RUN_TIMEOUT="${RUN_TIMEOUT:-1800}"
# The served context: a phone with RAM to spare serves far more than the 16k
# floor (our 8 GB test phone: 177k+ for the 0.8B), and Claude Code's own
# prompt alone is about 12.6k tokens, so it refuses a 16k window outright.
CONTEXT="${CONTEXT:-65536}"
# Plain on purpose: naming tools ("do not use any tools") sent opencode on
# Qwen3.5-0.8B into a loop of tool calls.
PROMPT="${PROMPT:-Say hello in one short sentence.}"
EXPECT="${EXPECT:-hello}"
MODELS="${MODELS:-$HERE/models.json}"
PORT=18080
LIB_DIR=/opt/phonecando/lib

KIND=""
for type in image native; do
  [ -f "$REPO/agents/$type/$KIND_ID/agent.json" ] && KIND="$REPO/agents/$type/$KIND_ID" && TYPE="$type"
done
[ -n "$KIND" ] || { echo "leg: no agents/{image,native}/$KIND_ID/agent.json" >&2; exit 2; }
mkdir -p "$SCRATCH"
SCRATCH="$(cd "$SCRATCH" && pwd -P)"
: >"$SCRATCH/results.jsonl"

FAILED=0
LOGS=""
oneline() { tr '\n' ' ' <<<"$1" | sed 's/\x1b\[[0-9;?]*[A-Za-z]//g; s/ *$//; s/|/\\|/g' | cut -c1-100; }
row() { printf '| %s | %s | %ss | %s |\n' "$1" "$2" "$3" "$4"; }
pass() { row "$1" OK "$2" "$3"; }
fail() {
  FAILED=$((FAILED + 1))
  row "$1" "**FAIL**" "$2" "$3"
  [ -n "${4-}" ] && LOGS+=$'\n'"<details><summary>$1</summary>"$'\n\n```\n'"$(tail -n 80 <<<"$4")"$'\n```\n</details>\n'
}
result() { # <model> <ok> <secs> <detail>
  jq -cn --arg kind "$KIND_ID" --arg model "$1" --argjson ok "$2" --argjson secs "$3" --arg detail "$4" \
    '{kind: $kind, model: $model, ok: $ok, secs: $secs, detail: $detail}' >>"$SCRATCH/results.jsonl"
}

LLAMA_API_KEY="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
export LLAMA_API_KEY
C="phonecando-lm-$KIND_ID-$$"
SERVER_PID=""
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null && wait "$SERVER_PID" 2>/dev/null
  docker rm -f "$C" >/dev/null 2>&1
  rm -f "$SCRATCH/run.env"
}
trap cleanup EXIT

echo "### \`$KIND_ID\` ($TYPE) on our llama-server"
echo
echo "| Check | | Time | Output |"
echo "|---|---|---|---|"

# --- machine and install ---
start=$SECONDS
if ! docker run -d --name "$C" --network host --init "$MACHINE" sleep infinity >"$SCRATCH/machine.log" 2>&1; then
  fail "machine ($MACHINE)" $((SECONDS - start)) "docker run failed" "$(cat "$SCRATCH/machine.log")"
  echo "$LOGS"
  exit 1
fi
installed=false
start=$SECONDS
if [ "$TYPE" = image ]; then
  limit="$(jq -r '.install.timeoutSec // 1800' "$KIND/agent.json")"
  if "$KIT_CLI" render-install --kind "$KIND" --family apt </dev/null >"$SCRATCH/install.sh" 2>"$SCRATCH/render-install.log" &&
    docker cp "$SCRATCH/install.sh" "$C:/root/.ci-install.sh" >/dev/null &&
    docker exec -e HOME=/root -w /root "$C" timeout "$limit" sh /root/.ci-install.sh >"$SCRATCH/install.log" 2>&1; then
    installed=true
    # The version check's output follows its phase line.
    version="$(sed -n '/^@phase verify$/{n;p;q}' "$SCRATCH/install.log")"
    pass "install (kit-cli render-install, apt)" $((SECONDS - start)) "$(oneline "${version:-installed}")"
  else
    fail "install (kit-cli render-install, apt)" $((SECONDS - start)) "failed" \
      "$(cat "$SCRATCH/render-install.log" "$SCRATCH/install.log" 2>/dev/null)"
  fi
else
  if docker cp "$KIND" "$C:/tmp/kind" >/dev/null &&
    docker exec -e HOME=/root -w /root "$C" timeout 1800 sh /tmp/kind/ci/host-engine.sh "$LIB_DIR" >"$SCRATCH/install.log" 2>&1; then
    installed=true
    pass "install (ci/host-engine.sh)" $((SECONDS - start)) "$(oneline "$(tail -n 1 "$SCRATCH/install.log")")"
  else
    fail "install (ci/host-engine.sh)" $((SECONDS - start)) "failed" "$(cat "$SCRATCH/install.log")"
  fi
fi

# --- per model: serve, render, run ---
serve() { # <plan.json> <log>: the plan's argv, the key in the variable the plan names
  local argv=() keyenv
  mapfile -t argv < <(jq -r '.argv[]' "$1")
  keyenv="$(jq -r '.keyEnv' "$1")"
  (
    export "$keyenv=$LLAMA_API_KEY"
    exec "${argv[@]}"
  ) </dev/null >"$2" 2>&1 &
  SERVER_PID=$!
  local health
  health="$(jq -r '.healthUrl' "$1")"
  for _ in $(seq 1 300); do
    curl -fsS -o /dev/null "$health" 2>/dev/null && return 0
    kill -0 "$SERVER_PID" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}

stop() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null && wait "$SERVER_PID" 2>/dev/null
  SERVER_PID=""
}

while $installed && IFS=$'\t' read -r model file; do
  out="$SCRATCH/$model"
  mkdir -p "$out"
  start=$SECONDS
  if ! "$LME_CLI" plan --model "$MODELS_DIR/$file" --id "$model" --server "$SERVER" --port "$PORT" \
    --key-env LLAMA_API_KEY --context "$CONTEXT" </dev/null >"$out/plan.json" 2>"$out/plan.log"; then
    fail "$model: lme-cli plan" $((SECONDS - start)) "failed" "$(cat "$out/plan.log")"
    result "$model" false $((SECONDS - start)) "lme-cli plan failed"
    continue
  fi
  if ! serve "$out/plan.json" "$out/server.log"; then
    fail "$model: serve" $((SECONDS - start)) "not ready" "$(cat "$out/server.log")"
    result "$model" false $((SECONDS - start)) "server not ready"
    stop
    continue
  fi
  ctx="$(jq -r '.endpoint.contextWindow' "$out/plan.json")"
  pass "$model: serve" $((SECONDS - start)) "context $ctx, $(jq -r '.endpoint.apis | join(", ")' "$out/plan.json")"

  lib=()
  [ "$TYPE" = native ] && lib=(--lib-dir "$LIB_DIR")
  if ! "$KIT_CLI" render-model --kind "$KIND" \
    --base-url "$(jq -r '.endpoint.baseUrl' "$out/plan.json")" \
    --model "$(jq -r '.endpoint.model' "$out/plan.json")" \
    --context "$ctx" --apis "$(jq -r '.endpoint.apis | join(",")' "$out/plan.json")" \
    --key-env LLAMA_API_KEY --prompt "$PROMPT" "${lib[@]}" </dev/null >"$out/launch.json" 2>"$out/render.log"; then
    fail "$model: kit-cli render-model" 0 "refused" "$(cat "$out/render.log")"
    result "$model" false 0 "$(oneline "$(cat "$out/render.log")")"
    stop
    continue
  fi
  api="$(jq -r '.api' "$out/launch.json")"

  # The env file holds the key: 0600, removed after the run.
  (umask 077 && jq -r '(.env, (.keyEnv | map_values(gsub("\\{\\{modelKey\\}\\}"; $ENV.LLAMA_API_KEY))))
      | to_entries[] | "\(.key)=\(.value)"' "$out/launch.json" >"$SCRATCH/run.env")
  if [ "$(wc -l <"$SCRATCH/run.env")" != "$(jq '(.env + .keyEnv) | length' "$out/launch.json")" ]; then
    fail "$model: run" 0 "an env value spans lines" ""
    result "$model" false 0 "an env value spans lines"
    stop
    continue
  fi
  mapfile -t argv < <(jq -r '.argv[]' "$out/launch.json")
  path="$(jq -r '.path | join(":")' "$out/launch.json")"
  # As ImageLaunch's sh -c: the runtimes first on PATH, then exec the program
  # (expanded by the machine's sh, not here).
  # shellcheck disable=SC2016
  script='exec "$0" "$@"'
  [ -n "$path" ] && script="PATH='$path':\$PATH; export PATH; $script"
  # The work folder ({{projectDir}}), made first as the runner makes it.
  cwd="$(jq -r '.cwd' "$out/launch.json")"
  docker exec "$C" mkdir -p "$cwd"
  start=$SECONDS
  docker exec --env-file "$SCRATCH/run.env" -w "$cwd" "$C" \
    timeout "$RUN_TIMEOUT" sh -c "$script" "${argv[@]}" </dev/null >"$out/reply.txt" 2>"$out/stderr.txt"
  rc=$?
  secs=$((SECONDS - start))
  rm -f "$SCRATCH/run.env"
  # The row shows the answer's line (else the last lines), not a banner.
  reply="$(oneline "$(grep -iE "$EXPECT" "$out/reply.txt" | tail -n 1)")"
  [ -n "$reply" ] || reply="$(oneline "$(grep -v '^[[:space:]]*$' "$out/reply.txt" | tail -n 2)")"
  # Answers the server finished (one server per model, this run its only client).
  answers="$(grep -cE '\| +eval time = +[0-9.]+ ms / +[1-9][0-9]* tokens' "$out/server.log")"
  output=false
  grep -q '[^[:space:]]' "$out/reply.txt" && output=true
  if [ "$rc" -eq 0 ] && $output && [ "$answers" -gt 0 ]; then
    grep -qiE "$EXPECT" "$out/reply.txt" || reply="(no /$EXPECT/i) $reply"
    pass "$model: one-shot over $api" "$secs" "$reply"
    result "$model" true "$secs" "$reply"
  else
    why="exit $rc"
    [ "$rc" -eq 124 ] && why="timed out after ${RUN_TIMEOUT}s"
    [ "$rc" -eq 0 ] && ! $output && why="nothing on stdout"
    [ "$rc" -eq 0 ] && $output && why="the server finished no answer"
    err="$(oneline "$(grep -v '^\s*$' "$out/stderr.txt" | tail -n 3)")"
    fail "$model: one-shot over $api" "$secs" "$why${err:+: $err}" \
      "$(printf '%s\n--- stderr ---\n%s\n--- server ---\n%s\n' "$(cat "$out/reply.txt")" "$(cat "$out/stderr.txt")" "$(grep -iE 'error|exception|fail' "$out/server.log" | tail -n 20)")"
    result "$model" false "$secs" "$why${err:+: $err}"
  fi
  stop
done < <(jq -r '.[] | [.id, .file] | @tsv' "$MODELS")

echo
[ -n "$LOGS" ] && printf '%s\n' "$LOGS"
[ "$FAILED" -eq 0 ] && $installed
