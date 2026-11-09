#!/usr/bin/env bash
# One agents leg of lre-compat.yml: a runtime plugin (agents/runtimes/<id>/)
# installed into a Tier 2 image the way the phone installs an agent that
# needs it. A test kind ci-<id>, which needs only that runtime, goes through
# kit-render's InstallRenderer (kit-cli render-install), and the script runs
# in the image as the phone's install job runs it.
#
#   setup        cli setup --ref, as leg.sh: the image and its family
#   render       kit-cli render-install --kind ci-<id> --family <family>
#   install      the script in the image (sh, HOME the image home): the
#                runtime's install script, the kind's step, its versionCheck;
#                every @phase line the renderer promised shows up
#   check        the runtime's check argv with its paths first on PATH, as
#                the agent's engine runs; group 1 is at least `provides`
#   again        the script a second time passes (every part is idempotent)
#
# Usage: agent-leg.sh <runtime-id> <ref> <family> <payload-dir> <kit-cli-dir> <scratch>
#   <payload-dir>  payload.sh's tree (lib/ and cli/), as for leg.sh
#   <kit-cli-dir>  kit-cli's install tree (agents: ./gradlew :kit-cli:installDist)
#   <scratch>      created; the image is <scratch>/images/a1
#   Markdown on stdout, exit 1 on any FAIL. Needs network, jq and java.
set -uo pipefail
export LC_ALL=C

usage="usage: agent-leg.sh <runtime-id> <ref> <family> <payload-dir> <kit-cli-dir> <scratch>"
RUNTIME="${1:?$usage}"
REF="${2:?$usage}"
FAMILY="${3:?$usage}"
PAYLOAD="$(cd "${4:?$usage}" && pwd -P)" || exit 2
KIT_CLI="$(cd "${5:?$usage}" && pwd -P)/bin/kit-cli" || exit 2
SCRATCH="${6:?$usage}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIMES="$(cd "$HERE/../../../agents/runtimes" && pwd)" || exit 2
PLUGIN="$RUNTIMES/$RUNTIME/runtime.json"
# shellcheck source=checks.sh
. "$HERE/checks.sh"

[ -f "$PLUGIN" ] || {
  echo "agent-leg: no $PLUGIN" >&2
  exit 2
}
mkdir -p "$SCRATCH"
SCRATCH="$(cd "$SCRATCH" && pwd -P)"
CLI="$PAYLOAD/cli/bin/cli"
LIB="$PAYLOAD/lib"
IMG="$SCRATCH/images/a1"
TIMEOUT=300
# The runtime's download and unpack, and any package installs, under ptrace.
INSTALL_TIMEOUT=1800

provides="$(jq -r '.provides' "$PLUGIN")"
check_pattern="$(jq -r '.check.pattern' "$PLUGIN")"
# The runtime's check, as the kind's install step: proof the runtime is on
# PATH while the steps run. Node's also runs npm, which kinds install with.
step="$(jq -r '.check.argv | map(@sh) | join(" ")' "$PLUGIN")"
case "$RUNTIME" in
  node) step="$step && npm --version" ;;
esac

echo "### \`$RUNTIME\` on \`$REF\` ($(uname -m), family \`$FAMILY\`)"
echo
echo "| Check | | Time | Output |"
echo "|---|---|---|---|"

# --- setup: as leg.sh ---
start=$SECONDS
"$CLI" setup --ref "$REF" --image-dir "$IMG" --lib-dir "$LIB" >"$SCRATCH/setup.json" 2>"$SCRATCH/setup.log"
rc=$?
setup="$(tail -n 1 "$SCRATCH/setup.json")"
family=""
if [ "$rc" -eq 0 ] && jq -e '.os != null' <<<"$setup" >/dev/null 2>&1; then
  family="$(jq -r '.os.family // "none"' <<<"$setup")"
  pass "cli setup --ref" $((SECONDS - start)) "$(jq -r '.os.prettyName // .os.id' <<<"$setup")"
else
  fail "cli setup --ref" $((SECONDS - start)) "exit $rc" "$(cat "$SCRATCH/setup.log" "$SCRATCH/setup.json")"
fi

if [ -n "$family" ] && [ "$family" != "$FAMILY" ]; then
  fail "package family" 0 "want \`$FAMILY\`, got \`$family\`"
  family=""
fi

if [ -n "$family" ]; then
  HOME_DIR="$(sed -n 's/^HOME=//p' "$IMG/run/engine.env")"

  # --- the test kind: needs only this runtime ---
  KIND="$SCRATCH/kinds/ci-$RUNTIME"
  mkdir -p "$KIND"
  jq -n --arg id "ci-$RUNTIME" --arg need "$RUNTIME>=$provides" --arg step "$step" \
    --slurpfile plugin "$PLUGIN" '$plugin[0] as $p | {
      schema: 1, id: $id, label: $id, version: "0.0.0", type: "image",
      channels: ["full", "lite"], stability: "preview",
      licence: {spdx: $p.licence.spdx, redistributed: false, source: $p.licence.source},
      requires: {linux: "required", runtimes: [$need]},
      install: {steps: [$step], timeoutSec: 1800},
      versionCheck: $p.check,
      engine: {style: "tui", launch: {argv: ["true"]}, readiness: {alive: {ms: 500}}},
      surfaces: {home: "tui", terminal: {shell: true}}
    }' >"$KIND/agent.json"

  # --- render: the script the phone's install job runs ---
  SCRIPT="$HOME_DIR/.ci-install.sh"
  start=$SECONDS
  if "$KIT_CLI" render-install --kind "$KIND" --family "$FAMILY" --runtimes "$RUNTIMES" \
    >"$SCRIPT" 2>"$SCRATCH/render.log" && [ -s "$SCRIPT" ]; then
    pass "kit-cli render-install" $((SECONDS - start)) "$(wc -l <"$SCRIPT") lines"
  else
    fail "kit-cli render-install" $((SECONDS - start)) "no script" "$(cat "$SCRATCH/render.log" "$SCRIPT")"
    SCRIPT=""
  fi

  if [ -n "$SCRIPT" ]; then
    # --- install: as the phone's job, sh in the image with HOME its home ---
    TIMEOUT=$INSTALL_TIMEOUT check "install (sh, the rendered script)" ok '' in_image "$HOME_DIR" "sh '$SCRIPT'"
    installed="$OUT"
    for phase in "runtime:$RUNTIME" packages install verify; do
      if grep -qx "@phase $phase" <<<"$installed"; then
        pass "@phase $phase" 0 "-"
      elif [ "$phase" = packages ]; then
        # The test kind names no packages; a renderer may leave the phase out.
        skip "@phase packages" "no packages"
      else
        fail "@phase $phase" 0 "not printed" "$installed"
      fi
    done

    # --- check: the runtime's paths first on PATH, as the engine runs ---
    path="$(jq -r --arg home "$HOME_DIR" '(.paths // []) | map(gsub("\\{\\{home\\}\\}"; $home)) | join(":")' "$PLUGIN")"
    argv="$(jq -r --arg home "$HOME_DIR" '.check.argv | map(gsub("\\{\\{home\\}\\}"; $home) | @sh) | join(" ")' "$PLUGIN")"
    check "check: $argv" ok '' in_image "$HOME_DIR" \
      "PATH='$path':\$PATH; export PATH; command -v $(jq -r '.check.argv[0]' "$PLUGIN") && $argv"
    # The pattern as an ERE (\d is all a runtime's pattern may add to it).
    ere="${check_pattern//\\d/[0-9]}"
    found=""
    while IFS= read -r line; do
      if [[ "$line" =~ $ere ]]; then
        found="${BASH_REMATCH[1]}"
        break
      fi
    done <<<"$OUT"
    if [[ "$found" =~ ^[0-9]+$ ]] && [ "$found" -ge "$provides" ]; then
      pass "major $found >= provides $provides" 0 "\`$(oneline "${OUT%%$'\n'*}")\`"
    else
      fail "major >= provides $provides" 0 "got \`${found:-nothing}\`" "$OUT"
    fi

    # --- again: every part is idempotent ---
    TIMEOUT=$INSTALL_TIMEOUT check "install again (idempotent)" ok '' in_image "$HOME_DIR" "sh '$SCRIPT'"
  fi
fi

echo
[ -n "$LOGS" ] && printf '%s\n' "$LOGS"

[ "${#FAILED[@]}" -eq 0 ]
