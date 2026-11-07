#!/usr/bin/env bash
# Host tests for the launcher (lre/launcher). Builds it and the unit tests
# (unit.c) with $CC (default gcc) -std=c11 -Wall -Wextra -Werror, then runs
# it end to end in a temp image whose launch.conf points at a fake proot
# (fake-proot.sh prints its argv and the env vars we check).
#   bash lre/launcher/test/run.sh
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
src=$here/../src
cc=${CC:-gcc}
flags=(-std=c11 -O2 -Wall -Wextra -Werror)

work=$(mktemp -d "${TMPDIR:-/tmp}/lre-launcher.XXXXXX")
work=$(cd "$work" && pwd -P) # getcwd() reports the physical path
trap 'rm -rf -- "$work"' EXIT

echo "compiler: $("$cc" --version | head -n 1)"
launcher=$work/libphonecando_launch.so
"$cc" "${flags[@]}" -o "$launcher" "$src/conf.c" "$src/plan.c" "$src/main.c"
"$cc" "${flags[@]}" -I "$src" -o "$work/unit" "$here/unit.c" "$src/conf.c" "$src/plan.c"
"$work/unit"
# A real (empty) library to preload: the dynamic loader honours LD_PRELOAD
# on the way to the launcher and complains about one it cannot open.
"$cc" -shared -fPIC -o "$work/libhook.so" -x c /dev/null

install -m 0755 "$here/fake-proot.sh" "$work/proot"
mkdir -p "$work/shims" "$work/proj/sub" "$work/project2" "$work/img/run" "$work/plain/run"
for name in git bash; do ln -s ../libphonecando_launch.so "$work/shims/$name"; done
img=$work/img
conf=$img/run/launch.conf

cat >"$conf" <<EOF
# A comment and an empty line are skipped.

arg $work/proot
arg --rootfs=$img/rootfs
arg --bind=/data/app/x y:/opt/x y
unset LD_*
unset OPENCODE_SERVER_PASSWORD
set PATH=/usr/local/bin:/usr/bin:/bin
set LD_LIBRARY_PATH=/guest/lib
map bash /bin/sh
same $work/proj
home /root
EOF
# No map and no home: bash stays bash, the cwd falls back to /.
printf 'arg %s\n' "$work/proot" >"$work/plain/run/launch.conf"

passed=0 failed=0
image=$img

# run DIR CMD...: CMD in DIR with a fixed environment (PHONECANDO_IMAGE from
# $image, left out when empty); sets out, err and status.
run() {
  local dir=$1
  shift
  local vars=(PATH=/host/bin:/usr/bin:/bin "LD_PRELOAD=$work/libhook.so" LD_LIBRARY_PATH=/host/lib
    OPENCODE_SERVER_PASSWORD=hunter2 OPENCODE_SERVER_USERNAME=opencode KEEP_ME=kept)
  [[ -n $image ]] && vars+=("PHONECANDO_IMAGE=$image")
  status=0
  (cd "$dir" && env -i "${vars[@]}" "$@") >"$work/out" 2>"$work/err" || status=$?
  out=$(cat "$work/out")
  err=$(cat "$work/err")
}

result() {
  if [[ $1 == ok ]]; then
    passed=$((passed + 1))
    echo "ok   $2"
  else
    failed=$((failed + 1))
    echo "FAIL $2"
    printf '  status %s\n  --- stdout\n%s\n  --- stderr\n%s\n  --- wanted\n%s\n' "$status" "$out" "$err" "$3"
  fi
}

# expect_run NAME WANT: status 0, nothing on stderr, stdout == WANT.
expect_run() {
  if [[ $status == 0 && -z $err && $out == "$2" ]]; then result ok "$1"; else result fail "$1" "$2"; fi
}

# expect_error NAME MESSAGE: status 127, no stdout, stderr == our prefix + MESSAGE.
expect_error() {
  local want="phonecando-launch: $2"
  if [[ $status == 127 && -z $out && $err == "$want" ]]; then result ok "$1"; else result fail "$1" "$want"; fi
}

# The proot args every run of $img starts with, and the env its guest gets.
proot_args="argv $work/proot
argv --rootfs=$img/rootfs
argv --bind=/data/app/x y:/opt/x y"
guest_env="env PATH=/usr/local/bin:/usr/bin:/bin
env LD_PRELOAD unset
env LD_LIBRARY_PATH=/guest/lib
env OPENCODE_SERVER_PASSWORD unset
env OPENCODE_SERVER_USERNAME=opencode
env KEEP_ME=kept"

run "$work" "$work/shims/git" status --short "two words"
expect_run 'symlinked shim: args, --cwd=home, command, forwarded args, env' "$proot_args
argv --cwd=/root
argv git
argv status
argv --short
argv two words
$guest_env"

run "$work/proj" "$work/shims/git" log
expect_run 'cwd equal to a same path is kept' "$proot_args
argv --cwd=$work/proj
argv git
argv log
$guest_env"

run "$work/proj/sub" "$work/shims/git" log
expect_run 'cwd under a same path is kept' "$proot_args
argv --cwd=$work/proj/sub
argv git
argv log
$guest_env"

run "$work/project2" "$work/shims/git" log
expect_run 'cwd outside every same path (shared prefix) uses home' "$proot_args
argv --cwd=/root
argv git
argv log
$guest_env"

run "$work" "$work/shims/bash" -lc 'echo hi'
expect_run 'map bash /bin/sh' "$proot_args
argv --cwd=/root
argv /bin/sh
argv -lc
argv echo hi
$guest_env"

run "$work" "$launcher" -c 'echo x'
expect_run 'own name runs bash, mapped to /bin/sh' "$proot_args
argv --cwd=/root
argv /bin/sh
argv -c
argv echo x
$guest_env"

image=$work/plain
run "$work/proj" "$launcher" -c 'echo x'
expect_run 'own name runs bash; no home means /' "argv $work/proot
argv --cwd=/
argv bash
argv -c
argv echo x
env PATH=/host/bin:/usr/bin:/bin
env LD_PRELOAD=$work/libhook.so
env LD_LIBRARY_PATH=/host/lib
env OPENCODE_SERVER_PASSWORD=hunter2
env OPENCODE_SERVER_USERNAME=opencode
env KEEP_ME=kept"

image=
run "$work" "$work/shims/git" status
expect_error 'no PHONECANDO_IMAGE' 'PHONECANDO_IMAGE is not set'

image=img
run "$work" "$work/shims/git" status
expect_error 'relative PHONECANDO_IMAGE' 'PHONECANDO_IMAGE is not an absolute path'

image=$work/none
run "$work" "$work/shims/git" status
expect_error 'missing launch.conf' "cannot read $work/none/run/launch.conf: No such file or directory"

image=$img
printf 'arg %s\nbogus value\n' "$work/proot" >"$conf"
run "$work" "$work/shims/git" status
expect_error 'unknown keyword' "$conf:2: unknown keyword"

printf '# nothing to run\nhome /root\n' >"$conf"
run "$work" "$work/shims/git" status
expect_error 'no arg' "$conf: no arg line"

printf 'arg %s\n' "$work/missing-proot" >"$conf"
run "$work" "$work/shims/git" status
expect_error 'exec failure' "cannot run $work/missing-proot: No such file or directory"

# Exactly 256 KiB runs; one byte more is refused.
first="arg $work/proot"
pad=$((256 * 1024 - ${#first} - 2))
{ echo "$first"; printf '%*s\n' "$pad" '' | tr ' ' '#'; } >"$conf"
run "$work" "$work/shims/git" status
expect_run 'launch.conf of exactly 256 KiB' "argv $work/proot
argv --cwd=/
argv git
argv status
env PATH=/host/bin:/usr/bin:/bin
env LD_PRELOAD=$work/libhook.so
env LD_LIBRARY_PATH=/host/lib
env OPENCODE_SERVER_PASSWORD=hunter2
env OPENCODE_SERVER_USERNAME=opencode
env KEEP_ME=kept"

{ echo "$first"; printf '%*s\n' "$((pad + 1))" '' | tr ' ' '#'; } >"$conf"
run "$work" "$work/shims/git" status
expect_error 'oversize launch.conf' "$conf: over 256 KiB"

echo "launcher: $passed passed, $failed failed"
[[ $failed == 0 ]]
