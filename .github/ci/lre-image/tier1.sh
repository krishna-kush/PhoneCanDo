#!/usr/bin/env bash
# Tier 1 test of the Default env image (blocks publishing): run commands
# exactly as opencode would, through the shims, after setup.sh laid the
# image out. The engine's environment is run/engine.env; a shell command is
# `$SHELL -c "<command>"` with SHELL=shims/bash; tools are the shims on PATH.
#
#   versions      bash, git, rg, python3 through $SHELL -c
#   shims         git, rg, python3, pip, sh run directly
#   fake root     id -u is 0; the image marker names the version
#   locale        python3 sees UTF-8
#   cwd           a cwd under home/ is the same path inside; outside -> /root
#   home          home/ is the same dir at its own path and at /root
#   git           init + commit in a project under home/, read back by the
#                 git shim from the host side
#   hardlinks     ln works under --link2symlink (home and rootfs)
#   python        python3 -m venv + pip install of a pure-Python package
#   apt           apt-get update && apt-get install -y as the faked root
#
# Usage: tier1.sh <scratch> [version]
#   <scratch>  setup.sh's scratch; [version] the image version the marker
#              must name. Needs network (deb.debian.org, pypi.org).
#   Markdown on stdout, exit 1 on any FAIL.
set -uo pipefail
export LC_ALL=C

SCRATCH="$(cd "${1:?usage: tier1.sh <scratch> [version]}" && pwd -P)"
WANT_VERSION="${2-}"
IMG="$SCRATCH/img"
HOME_DIR="$IMG/home"
mapfile -t ENGINE_ENV < "$IMG/run/engine.env"
SHELL_BIN="$IMG/shims/bash"
TIMEOUT=900
# The host's timeout, by path: with the engine's PATH (shims/ first) a bare
# `timeout` would be the guest's when setup shimmed every guest command.
TIMEOUT_BIN="$(command -v timeout)"

fail=0
logs=""
oneline() { tr '\n' ' ' <<<"$1" | sed 's/ *$//; s/|/\\|/g' | cut -c1-90; }

# engine CWD PROGRAM ARGS...: PROGRAM in CWD with the engine's environment.
engine() {
  local cwd="$1"
  shift
  (cd "$cwd" && env "${ENGINE_ENV[@]}" "$TIMEOUT_BIN" "$TIMEOUT" "$@") 2>&1
}

# check NAME CWD eq|re|last WANT PROGRAM ARGS...: exit code 0 and the output
# (stdout+stderr) equal to WANT (eq), matching the regex WANT (re), or with
# WANT as its last line (last).
check() {
  local name="$1" cwd="$2" mode="$3" want="$4" out rc start secs pass=false
  shift 4
  start=$SECONDS
  out="$(engine "$cwd" "$@")"
  rc=$?
  secs=$((SECONDS - start))
  if [ "$rc" -eq 0 ]; then
    case "$mode" in
      eq) [ "$out" = "$want" ] && pass=true ;;
      re) [[ "$out" =~ $want ]] && pass=true ;;
      last) [ "${out##*$'\n'}" = "$want" ] && pass=true ;;
    esac
  fi
  if $pass; then
    # shellcheck disable=SC2016 # the backticks are markdown
    printf '| %s | OK | %ss | `%s` |\n' "$name" "$secs" "$(oneline "$out")"
  else
    printf '| %s | **FAIL** | %ss | exit %s |\n' "$name" "$secs" "$rc"
    logs+=$'\n'"<details><summary>$name (exit $rc)</summary>"$'\n\n```\n'"$out"$'\n```\nwanted ('"$mode"$'): '"$want"$'\n</details>\n'
    fail=1
  fi
}

# sh_c NAME CWD eq|re|last WANT COMMAND: `$SHELL -c COMMAND`, as opencode runs it.
sh_c() { check "$1" "$2" "$3" "$4" "$SHELL_BIN" -c "$5"; }

PROJ="$HOME_DIR/proj"
mkdir -p "$PROJ/sub"

echo "### Tier 1: the image through our launcher and proot ($(uname -m))"
echo
echo "| Check | | Time | Output |"
echo "|---|---|---|---|"

sh_c 'bash --version' "$PROJ" re '^GNU bash, version 5\.' 'bash --version | head -n 1'
sh_c 'git --version' "$PROJ" re '^git version 2\.' 'git --version'
sh_c 'rg --version' "$PROJ" re '^ripgrep [0-9]' 'rg --version | head -n 1'
sh_c 'python3 --version' "$PROJ" re '^Python 3\.' 'python3 --version'
check 'shim git' "$PROJ" re '^git version 2\.' "$IMG/shims/git" --version
check 'shim rg' "$PROJ" re '^ripgrep [0-9]' "$IMG/shims/rg" --version
check 'shim python3' "$PROJ" eq '2' "$IMG/shims/python3" -c 'print(1 + 1)'
check 'shim pip' "$PROJ" re '^pip [0-9]+' "$IMG/shims/pip" --version
check 'shim sh' "$PROJ" eq 'ok' "$IMG/shims/sh" -c 'echo ok'
sh_c 'fake root (id -u)' "$PROJ" eq '0' 'id -u'
if [ -n "$WANT_VERSION" ]; then
  # shellcheck disable=SC2016 # expands in the guest
  sh_c 'image marker' "$PROJ" eq "$WANT_VERSION" '. /etc/phonecando-image && echo "$VERSION"'
fi
sh_c 'UTF-8 locale' "$PROJ" eq 'utf-8 utf-8' \
  'python3 -c "import locale, sys; print(sys.getfilesystemencoding(), locale.getpreferredencoding().lower())"'
sh_c 'cwd under home kept' "$PROJ/sub" eq "$PROJ/sub" 'pwd'
sh_c 'cwd outside home -> /root' / eq '/root' 'pwd'
sh_c 'home at its path and at /root' "$PROJ" eq 'both' \
  "echo both > /root/tier1-both && cat '$HOME_DIR/tier1-both'"
sh_c 'git init + commit in home' "$PROJ" eq '1' \
  'git init -q && git config user.email ci@phonecando.invalid && git config user.name CI &&
   echo hello > README && git add README && git commit -qm tier1 && git rev-list --count HEAD'
check 'git shim reads it back (host cwd)' "$PROJ/sub" eq 'tier1' "$IMG/shims/git" log -1 --format=%s
sh_c 'hardlink in home (link2symlink)' "$PROJ" eq $'x\nx' \
  'echo x > hl-a && ln hl-a hl-b && cat hl-b && rm hl-a && cat hl-b && rm hl-b'
sh_c 'hardlink in rootfs (link2symlink)' "$PROJ" eq $'y\ny' \
  'echo y > /var/tmp/hl-a && ln /var/tmp/hl-a /var/tmp/hl-b && cat /var/tmp/hl-b &&
   rm /var/tmp/hl-a && cat /var/tmp/hl-b && rm /var/tmp/hl-b'
sh_c 'python3 -m venv + pip install six' "$PROJ" last '1.17.0' \
  'python3 -m venv /root/venv && /root/venv/bin/pip install -q --no-cache-dir --disable-pip-version-check six==1.17.0 &&
   /root/venv/bin/python -c "import six; print(six.__version__)"'
sh_c 'apt-get update && install hello (fake root)' "$PROJ" last 'Hello, world!' \
  'apt-get update -q && apt-get install -y -q --no-install-recommends hello && hello'

leftover="$(find "$IMG/run/proot-tmp" -type f -perm -u+x -print)"
if [ -z "$leftover" ]; then
  echo '| nothing executable in PROOT_TMP_DIR | OK | - | - |'
else
  echo "| nothing executable in PROOT_TMP_DIR | **FAIL** | - | \`$(oneline "$leftover")\` |"
  fail=1
fi

echo
[ -n "$logs" ] && printf '%s\n' "$logs"
exit "$fail"
