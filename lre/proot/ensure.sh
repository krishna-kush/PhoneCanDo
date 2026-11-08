#!/usr/bin/env bash
# Make sure the app carries a proot built from this tree's lre/proot, before
# `./manage build lite|full` and `./manage release` build an APK.
#
# The staged libs (stage.sh's dir) are
#   current   they match their SHA256SUMS and their INPUTS equals this
#             tree's (steps/inputs.sh): built from these pins, patches and
#             scripts
#   outdated  INPUTS missing or different (pins, patches or scripts changed
#             since), or the libs don't match SHA256SUMS
#   missing   nothing staged
# A current proot is used or, if asked, rebuilt; a missing or outdated one is
# built after asking: build-android.sh with the pinned NDK in dist/proot/,
# then verify.sh and stage.sh.
#
# Usage: lre/proot/ensure.sh [--yes | --check]
#   (none)   ask in a terminal; without one, use a current proot and stop
#            on anything else
#   --yes    no questions: use a current proot, build otherwise
#   --check  no questions, no build: print the state, exit 0 only if current
# Exit 1 when proot is not current and is not built. Env: PROOT_LIBS_DIR
# (default: stage.sh's dir), PROOT_WORK (default: dist/proot),
# ANDROID_NDK_HOME (used when it is pins.env's NDK, else the matching one
# under $ANDROID_HOME/ndk/ is found).
set -euo pipefail
export LC_ALL=C TZ=UTC

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=steps/sources.sh
. "$HERE/steps/sources.sh"
# shellcheck source=steps/inputs.sh
. "$HERE/steps/inputs.sh"
pins_load

ROOT="$(cd "$HERE/../.." && pwd)"
LIBS="${PROOT_LIBS_DIR:-$ROOT/app/modules/phonecando-linux/android/src/linux/libs/arm64-v8a}"
WORK="${PROOT_WORK:-$ROOT/dist/proot}"

mode=ask
case "${1:-}" in
  "") ;;
  --yes) mode=yes ;;
  --check) mode=check ;;
  *) echo "usage: ensure.sh [--yes | --check]" >&2; exit 2 ;;
esac
[ "$mode" = ask ] && [ ! -t 0 ] && mode=auto

if [ -t 1 ]; then yellow=$'\e[33m' red=$'\e[31m' plain=$'\e[0m'; else yellow='' red='' plain=''; fi
say() { printf 'proot: %s\n' "$*"; }
stop() { printf '%sproot: %s%s\n' "$red" "$*" "$plain" >&2; exit 1; }

# state and reason of the staged libs
state=current reason=
if [ ! -e "$LIBS/libproot.so" ] && [ ! -e "$LIBS/libproot-loader.so" ]; then
  state=missing
elif [ ! -f "$LIBS/libproot.so" ] || [ ! -f "$LIBS/libproot-loader.so" ] || [ ! -f "$LIBS/SHA256SUMS" ]; then
  state=outdated reason="the staged files are incomplete"
elif ! (cd "$LIBS" && sha256sum --quiet -c SHA256SUMS) >/dev/null 2>&1; then
  state=outdated reason="the libs don't match their SHA256SUMS"
elif [ ! -f "$LIBS/INPUTS" ]; then
  state=outdated reason="it has no INPUTS record (staged before ensure.sh)"
elif [ "$(cat "$LIBS/INPUTS")" != "$(inputs_digest)" ]; then
  state=outdated reason="pins, patches or build scripts in lre/proot changed since it was built"
fi
short() { sha256sum "$1" | cut -c1-12; }

# ask PROMPT DEFAULT: the answer's first letter, lower case, DEFAULT on enter.
# The prompt goes to stderr: callers take the answer from stdout.
ask() {
  local reply
  printf '%s ' "$1" >&2
  read -r reply || reply=
  reply="${reply:-$2}"
  printf '%s' "${reply:0:1}" | tr '[:upper:]' '[:lower:]'
}

ndk_release() { sed -n 's/^Pkg\.ReleaseName *= *//p' "$1/source.properties" 2>/dev/null; }
find_ndk() {
  local d sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
  if [ -n "${ANDROID_NDK_HOME:-}" ] && [ "$(ndk_release "$ANDROID_NDK_HOME")" = "$NDK_VERSION" ]; then
    echo "$ANDROID_NDK_HOME"
    return 0
  fi
  for d in "$sdk"/ndk/*/; do
    d="${d%/}"
    if [ "$(ndk_release "$d")" = "$NDK_VERSION" ]; then echo "$d"; return 0; fi
  done
  return 1
}

build() {
  local ndk
  ndk="$(find_ndk)" || stop "Android NDK $NDK_VERSION (pins.env) is not installed. Install it with the SDK's \
command-line tool (it lists it as NDK $NDK_VERSION), or set ANDROID_NDK_HOME to it; or stage GitHub's \
build: lre/proot/stage.sh on the unzipped proot-android-arm64 download of a proot.yml run."
  mkdir -p "$WORK"
  say "building $PROOT_VERSION with NDK $NDK_VERSION in ${WORK#"$ROOT"/}/ (about a minute)"
  if ! ANDROID_NDK_HOME="$ndk" bash "$HERE/build-android.sh" "$WORK" "$WORK/out" >"$WORK/build.log" 2>&1; then
    tail -n 25 "$WORK/build.log" >&2
    stop "the build failed (full log: ${WORK#"$ROOT"/}/build.log)"
  fi
  if ! bash "$HERE/verify.sh" "$WORK/out" >"$WORK/verify.log" 2>&1; then
    cat "$WORK/verify.log" >&2
    stop "the build failed its checks (verify.sh)"
  fi
  bash "$HERE/stage.sh" "$WORK/out" "$LIBS" >/dev/null
  say "staged into the app: libproot.so $(short "$LIBS/libproot.so"), built from these pins and patches"
}

case "$state" in
  current)
    what="the app's proot is current: built from these pins, patches and scripts (libproot.so $(short "$LIBS/libproot.so"))"
    case "$mode" in
      check | yes | auto) say "$what" ;;
      ask)
        say "$what"
        if [ "$(ask 'Use it, or rebuild it? [U/r]' u)" = r ]; then build; fi ;;
    esac ;;
  missing | outdated)
    if [ "$state" = missing ]; then
      what="the app has no proot (${LIBS#"$ROOT"/})"
    else
      what="the app's proot is out of date: $reason"
    fi
    case "$mode" in
      check) printf '%sproot: %s%s\n' "$yellow" "$what" "$plain"; exit 1 ;;
      yes) printf '%sproot: %s%s\n' "$yellow" "$what" "$plain"; build ;;
      auto) stop "$what; run this in a terminal to build it, or pass --yes" ;;
      ask)
        printf '%sproot: %s%s\n' "$yellow" "$what" "$plain"
        [ "$(ask "Build it now with NDK $NDK_VERSION (about a minute)? [Y/n]" y)" = y ] \
          || stop "not building: full and lite need a current proot (or pass --without-linux to a release)"
        build ;;
    esac ;;
esac
