#!/usr/bin/env bash
# One lre-compat leg (lre-compat.yml, Tier 2 and Tier 3): a registry image
# set up by the setup code the phone runs (lre-cli: lre/oci + lre/image),
# then used the way opencode uses it, through the shims, our launcher and
# proot.
#
#   setup        cli setup --ref: linux/arm64 pulled, ImageSetup.create
#                (--tarball for a <ref> that is an absolute path: a local
#                rootfs tarball as the one layer, the baked Default image's way)
#   family       the package family detected is <family> (none: no family
#                and no install command, the unknown-family path)
#   shell        $SHELL -c 'echo ok; id -u' prints ok, then 0 (fake root)
#   prep         <prep command>, when given: what the agent must run first
#                on this distro (EPEL for ripgrep on RHEL-likes)
#   install      the installCommand setup prints for the tools opencode
#                leans on (--tool bash git rg), as the faked root
#   refresh      cli refresh, as before every engine start: shims for the
#                commands the install added
#   git, rg      --version through their shims, as opencode runs them
#   git commit   git init && git commit --allow-empty in a project in home/,
#                read back by the git shim from the host side
#   cwd          a cwd under home/ is the same path inside, also after `cd`;
#                one outside is /root
#   background   `sleep 600 &` returns at once, as on a PC, and a later
#                command sees and ends it; exit 7 and a death by SIGTERM
#                come back as 7 and 143
#   proot tmp    nothing executable written to PROOT_TMP_DIR
# With <family> none the tool checks are skipped (nothing installs them).
#
# Usage: leg.sh <ref> <family|none> <payload-dir> <scratch> [<prep command>]
#   <ref>          an image reference, or /path/to/rootfs.tar[.gz|.xz]
#   <payload-dir>  payload.sh's tree: lib/ (libproot.so, libproot-loader.so,
#                  libphonecando_launch.so) and cli/ (lre-cli's installDist)
#   <scratch>      created; the image is <scratch>/images/c1
# Env: TIER (label in result.json, default leg).
#   Markdown on stdout, <scratch>/result.json for report.sh, exit 1 on any
#   FAIL. Needs network (the registry, the distro's mirrors), jq and java.
set -uo pipefail
export LC_ALL=C

usage="usage: leg.sh <ref> <family|none> <payload-dir> <scratch> [<prep command>]"
REF="${1:?$usage}"
FAMILY="${2:?$usage}"
PAYLOAD="$(cd "${3:?$usage}" && pwd -P)" || exit 2
SCRATCH="${4:?$usage}"
PREP="${5-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=checks.sh
. "$HERE/checks.sh"

mkdir -p "$SCRATCH"
SCRATCH="$(cd "$SCRATCH" && pwd -P)"
CLI="$PAYLOAD/cli/bin/cli"
LIB="$PAYLOAD/lib"
IMG="$SCRATCH/images/c1"
TIMEOUT=300
# Package installs under ptrace are slow (dnf and zypper most of all).
INSTALL_TIMEOUT=1800

echo "### \`$REF\` ($(uname -m), expect family \`$FAMILY\`)"
echo
echo "| Check | | Time | Output |"
echo "|---|---|---|---|"

# --- setup: download, ImageSetup.create and checkTools, the result as JSON ---
source_args=(--ref "$REF")
[[ "$REF" == /* ]] && source_args=(--tarball "$REF")
tool_args=(--tool bash --tool git --tool rg)
start=$SECONDS
"$CLI" setup "${source_args[@]}" "${tool_args[@]}" --image-dir "$IMG" --lib-dir "$LIB" \
  >"$SCRATCH/setup.json" 2>"$SCRATCH/setup.log"
rc=$?
secs=$((SECONDS - start))
setup="$(tail -n 1 "$SCRATCH/setup.json")"
os="" family="" missing="" install=""
if [ "$rc" -eq 0 ] && jq -e '.os != null' <<<"$setup" >/dev/null 2>&1; then
  os="$(jq -r '.os.prettyName // .os.id' <<<"$setup")"
  family="$(jq -r '.os.family // "none"' <<<"$setup")"
  missing="$(jq -r '.missingTools | join(" ")' <<<"$setup")"
  install="$(jq -r '.installCommand // ""' <<<"$setup")"
  mib="$(jq -r '.source.bytes / 1048576 | floor' <<<"$setup")"
  pass "cli setup ${source_args[0]}" "$secs" "$os, ${mib} MiB, missing: ${missing:-none}"
else
  fail "cli setup ${source_args[0]}" "$secs" "exit $rc" "$(cat "$SCRATCH/setup.log" "$SCRATCH/setup.json")"
fi

if [ -n "$os" ]; then
  if [ "$family" = "$FAMILY" ]; then
    pass "package family" 0 "\`$family\`"
  else
    fail "package family" 0 "want \`$FAMILY\`, got \`$family\`"
  fi

  HOME_DIR="$(sed -n 's/^HOME=//p' "$IMG/run/engine.env")"
  PROJ="$HOME_DIR/proj"
  mkdir -p "$PROJ/sub"

  check 'shell: echo ok; id -u' eq $'ok\n0' in_image "$PROJ" 'echo ok; id -u'

  # --- the agent's tools, installed the way the os note tells the agent ---
  tools=true
  if [ "$FAMILY" = none ]; then
    tools=false
    if [ -z "$install" ]; then
      pass "no install command" 0 "missing \`${missing:-none}\`, no package manager"
    else
      fail "no install command" 0 "got \`$install\`"
    fi
    skip "install, git, rg" "no package manager in the image"
  elif [ -z "$missing" ]; then
    skip "install agent tools" "nothing missing"
  elif [ -z "$install" ]; then
    fail "install agent tools" 0 "missing \`$missing\` but no install command"
  else
    if [ -n "$PREP" ]; then
      TIMEOUT=$INSTALL_TIMEOUT check "prep: \`$PREP\`" ok '' in_image "$PROJ" "$PREP"
    fi
    TIMEOUT=$INSTALL_TIMEOUT check "install: \`$install\`" ok '' in_image "$PROJ" "$install"
  fi
  check 'cli refresh (shims re-scanned)' re '"imageDir"' "$CLI" refresh --image-dir "$IMG" --lib-dir "$LIB"

  if $tools; then
    check 'git --version (shim)' re '^git version [0-9]' on_path "$PROJ" git --version
    check 'rg --version (shim)' re '^ripgrep [0-9]' on_path "$PROJ" rg --version
    check 'git init + commit --allow-empty in home' eq '1' in_image "$PROJ" \
      'git init -q && git -c user.email=ci@phonecando.invalid -c user.name=CI commit -q --allow-empty -m lre-compat &&
       git rev-list --count HEAD'
    check 'git shim reads it back (host cwd)' eq 'lre-compat' on_path "$PROJ/sub" git log -1 --format=%s
  fi

  # --- the cwd contract: same path under home/, /root elsewhere ---
  check 'cwd under home kept (pwd)' eq "$PROJ/sub" in_image "$PROJ/sub" 'pwd'
  check 'cd into the project (pwd)' eq "$PROJ/sub" in_image / "cd '$PROJ/sub' && pwd"
  check 'cwd outside home -> /root' eq '/root' in_image / 'pwd'

  # --- background processes, as on a PC: the command returns, its job runs on ---
  TIMEOUT=20 check 'background job: the command returns at once' re '^[0-9]+$' in_image "$PROJ" \
    'sleep 600 >/dev/null 2>&1 & echo $!'
  job="$OUT"
  TIMEOUT=20 check 'background job: a later command sees and ends it' eq 'ended' in_image "$PROJ" \
    "kill -0 '$job' && kill '$job' && echo ended"
  for want in '7:exit 7' '143:kill -TERM $$'; do
    start=$SECONDS
    in_image "$PROJ" "${want#*:}" >/dev/null 2>&1
    rc=$?
    if [ "$rc" = "${want%%:*}" ]; then
      pass "status of \`${want#*:}\`" $((SECONDS - start)) "\`$rc\`"
    else
      fail "status of \`${want#*:}\`" $((SECONDS - start)) "want ${want%%:*}, got $rc"
    fi
  done

  leftover="$(find "$IMG/run/proot-tmp" -type f -perm -u+x -print 2>/dev/null)"
  if [ -z "$leftover" ]; then
    pass "nothing executable in PROOT_TMP_DIR" 0 "-"
  else
    fail "nothing executable in PROOT_TMP_DIR" 0 "\`$(oneline "$leftover")\`"
  fi
fi

echo
[ -n "$LOGS" ] && printf '%s\n' "$LOGS"

verdict=pass
[ "${#FAILED[@]}" -gt 0 ] && verdict=fail
jq -n --arg tier "${TIER:-leg}" --arg ref "$REF" --arg expect "$FAMILY" --arg os "$os" \
  --arg family "$family" --arg missing "$missing" --arg install "$install" --arg prep "$PREP" \
  --argjson passed "$PASSED" --arg verdict "$verdict" \
  '{tier: $tier, ref: $ref, expectFamily: $expect, os: $os, family: $family, missingTools: $missing,
    installCommand: $install, prep: $prep, passed: $passed, failed: $ARGS.positional, verdict: $verdict}' \
  --args "${FAILED[@]}" >"$SCRATCH/result.json"

[ "$verdict" = pass ]
