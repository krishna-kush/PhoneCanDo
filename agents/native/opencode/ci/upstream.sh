#!/usr/bin/env bash
# Upstream contract for the opencode payload build: does our build still fit
# an anomalyco/opencode tree (+ the anomalyco/opentui tree it pins)? These are
# the checks docs/build.md "Bumping versions" asks a human to make.
# ci/check.sh runs them strict on the pinned tags and ci/drift.sh report-only
# on the newest upstream tag (agent-payload.yml's check and drift jobs).
#
#   upstream.sh latest-tag <git-url>    newest plain vX.Y.Z tag (ls-remote, sort -V)
#   upstream.sh opentui-pin <oc-dir>    the tree's @opentui/core pin
#   upstream.sh check <strict|report> <oc-dir> <opentui-dir>
#
# `check` prints a markdown table (+ failure details) and exits 1 on any FAIL.
# A pin that differs from build/pins.env is FAIL in strict mode and DRIFT
# (informational) in report mode.
set -euo pipefail
export LC_ALL=C
AGENT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../build/pins.env
. "$AGENT/build/pins.env"

latest_tag() {
  git ls-remote --tags --refs "$1" 'v*' \
    | awk '{ sub("^refs/tags/", "", $2); print $2 }' \
    | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n1
}

# The catalog pin (root package.json workspaces.catalog / catalog), else a
# direct dependency in packages/cli — the same place `grep '"@opentui/core"'`
# in docs/build.md lands.
opentui_pin() {
  local oc="$1" v
  v="$(jq -r '((.workspaces | objects | .catalog["@opentui/core"]) // .catalog["@opentui/core"]) // empty' "$oc/package.json")"
  [ -n "$v" ] || v="$(jq -r '.dependencies["@opentui/core"] // empty' "$oc/packages/cli/package.json")"
  case "$v" in
    "" | catalog:* | workspace:*) echo "no @opentui/core pin found in $oc" >&2; return 1 ;;
  esac
  v="${v#^}"; v="${v#\~}"
  printf '%s\n' "$v"
}

check() {
  local mode="$1" oc="$2" otui="$3"
  local fail=0 details=""
  row() { printf '| %s | %s | %s |\n' "$1" "$2" "$3"; }
  ok() { row "$1" OK "$2"; }
  bad() { row "$1" "**FAIL**" "$2"; fail=1; }
  pin() { # <what> <pins.env value> <tree value>
    if [ "$2" = "$3" ]; then ok "$1" "\`$3\`"
    elif [ "$mode" = strict ]; then bad "$1" "tree \`${3:-?}\`, pins.env \`$2\`"
    else row "$1" DRIFT "tree \`${3:-?}\`, pins.env \`$2\` (a bump moves both)"; fi
  }
  apply_check() { # <what> <repo> <patch>
    local log
    if log="$(git -C "$2" apply --check "$3" 2>&1)"; then ok "$1" "applies cleanly"
    else
      bad "$1" "does not apply (details below)"
      details+=$'\n'"<details><summary>$1</summary>"$'\n\n```\n'"$log"$'\n```\n</details>\n'
    fi
  }

  echo "| Check | Result | Detail |"
  echo "|---|---|---|"

  # 1. The two patches the driver applies (patch → tree mapping; pins.sh
  #    keeps this list in step with build/patches/).
  apply_check "build-android-target.patch → opencode" "$oc" \
    "$AGENT/build/patches/build-android-target.patch"
  apply_check "opentui-android-build.patch → opentui" "$otui" \
    "$AGENT/build/patches/opentui-android-build.patch"

  # 2. The CLI surface the driver drives build.ts through.
  local bts="$oc/packages/cli/script/build.ts" missing="" probe
  if [ -f "$bts" ]; then
    for probe in '"--target="' '"--outdir="' 'BUN_COMPILE_RELEASE'; do
      grep -qF -- "$probe" "$bts" || missing+=" ${probe//\"/}"
    done
    if [ -z "$missing" ]; then ok "build.ts driver interface" "\`--target=\`, \`--outdir=\`, \`BUN_COMPILE_RELEASE\`"
    else bad "build.ts driver interface" "no longer reads:$missing"; fi
  else
    bad "build.ts driver interface" "packages/cli/script/build.ts missing"
  fi

  # 3. Toolchain pins in the tree. @opencode/script rejects a Bun outside
  #    ^packageManager; OPENTUI_VERSION must equal the catalog pin or the
  #    JS/ABI drift only shows at runtime (docs/build.md "Bumping versions").
  local pm bun otv
  pm="$(jq -r '.packageManager // empty' "$oc/package.json")"
  bun="${pm#bun@}"
  pin "Bun pin (root packageManager)" "$BUN_VERSION" "$bun"
  otv="$(opentui_pin "$oc" || true)"
  pin "@opentui/core pin (catalog)" "$OPENTUI_VERSION" "$otv"
  # opentui's build.zig exits on any Zig outside SUPPORTED_ZIG_VERSIONS.
  local zigs
  zigs="$(awk '/SUPPORTED_ZIG_VERSIONS *=/ { on = 1 } on { print } on && /^};/ { exit }' \
            "$otui/packages/native/build.zig" 2>/dev/null \
          | grep -oE '\.major *= *[0-9]+, *\.minor *= *[0-9]+, *\.patch *= *[0-9]+' \
          | sed -E 's/[^0-9,]//g; s/,/./g' | paste -sd' ' - || true)"
  case " $zigs " in
    *" $ZIG_VERSION "*) ok "Zig supported by opentui build.zig" "\`$zigs\`" ;;
    *) if [ "$mode" = strict ]; then bad "Zig supported by opentui build.zig" "supports \`${zigs:-?}\`, pins.env \`$ZIG_VERSION\`"
       else row "Zig supported by opentui build.zig" DRIFT "supports \`${zigs:-?}\`, pins.env \`$ZIG_VERSION\`"; fi ;;
  esac

  # 4. The driver's step 3.5 edits the first chunk-bun-*.js of @opentui/core
  #    at a fixed anchor. Check the published package for that version.
  local anchor='async function resolveNativeLibraryPath() {' tmp chunks
  tmp="$(mktemp -d)"
  if [ -n "$otv" ] && (cd "$tmp" && npm pack --silent "@opentui/core@$otv" >/dev/null) \
     && tar -xzf "$tmp"/*.tgz -C "$tmp"; then
    chunks=("$tmp"/package/chunk-bun-*.js)   # same glob, first match, as the driver
    if [ -f "${chunks[0]}" ] && grep -qF -- "$anchor" "${chunks[0]}"; then
      ok "@opentui/core $otv lib-path anchor" "in \`${chunks[0]##*/}\`"
    elif [ -f "${chunks[0]}" ] && grep -qF 'OPENTUI_LIB_PATH) return' "${chunks[0]}"; then
      ok "@opentui/core $otv lib-path anchor" "override already upstream"
    else
      bad "@opentui/core $otv lib-path anchor" "\`$anchor\` not in the first chunk-bun-*.js"
    fi
  else
    bad "@opentui/core lib-path anchor" "could not fetch @opentui/core@${otv:-?} from npm"
  fi
  rm -rf "$tmp"

  # 5. Pair-era API: the home tab pairs through these routes (agent.json
  #    surfaces.web: pair.path, then the adapter's authUrl hand-off).
  local manifest="$AGENT/agent.json" route pair auth
  pair="$(jq -r '.surfaces.web.pair.path' "$manifest")"
  auth="$(jq -r '.surfaces.web.adapter.authUrl' "$manifest")"
  missing=""
  for route in "\"$pair\"" "$auth"; do
    grep -rqF --include='*.ts' --exclude-dir=test --exclude-dir=node_modules -- "$route" "$oc/packages" \
      || missing+=" ${route//\"/}"
  done
  if [ -z "$missing" ]; then ok "pair-era API" "\`$pair\`, \`$auth\`"
  else bad "pair-era API" "routes gone:$missing"; fi

  # 6. Web UI theme: the web adapter (agent.json surfaces.web.adapter) writes
  #    opencode v2's internal --v2-* vars (cssVars) and the color-scheme key;
  #    neither is public API and a rename fails silently on device
  #    (docs/build.md "Web UI theme").
  local css="$oc/packages/ui/src/styles/tokens/theme.css" var vars key n=0
  missing=""
  vars="$(jq -r '.surfaces.web.adapter.cssVars | keys_unsorted[]' "$manifest" | sort -u)"
  key="$(jq -r '.surfaces.web.adapter.colorSchemeKey // empty' "$manifest")"
  if [ -f "$css" ]; then
    for var in $vars; do
      n=$((n + 1))
      grep -qF -- "$var:" "$css" || missing+=" \`$var\`"
    done
    if [ "$n" -eq 0 ]; then bad "web UI theme vars" "no cssVars in agent.json's web adapter"
    elif [ -z "$missing" ]; then ok "web UI theme vars" "all $n agent.json \`cssVars\` defined in theme.css"
    else bad "web UI theme vars" "undefined in theme.css:$missing"; fi
  else
    bad "web UI theme vars" "packages/ui/src/styles/tokens/theme.css missing"
  fi
  if [ -n "$key" ] && [ -f "$oc/packages/ui/src/theme/v2/mapping.ts" ] \
     && grep -qF -- "$key" "$oc/packages/app/public/oc-theme-preload.js" 2>/dev/null; then
    ok "web UI scheme key" "\`$key\` in oc-theme-preload.js; mapping.ts present"
  else
    bad "web UI scheme key" "agent.json colorSchemeKey \`${key:-?}\` not in oc-theme-preload.js, or v2/mapping.ts moved"
  fi

  if [ -n "$details" ]; then printf '%s\n' "$details"; fi
  return "$fail"
}

case "${1:-}" in
  latest-tag) latest_tag "${2:?git url}" ;;
  opentui-pin) opentui_pin "${2:?opencode dir}" ;;
  check)
    case "${2:-}" in strict | report) ;; *) echo "mode must be strict|report" >&2; exit 2 ;; esac
    check "$2" "${3:?opencode dir}" "${4:?opentui dir}"
    ;;
  *) sed -n '2,14p' "$0" >&2; exit 2 ;;
esac
