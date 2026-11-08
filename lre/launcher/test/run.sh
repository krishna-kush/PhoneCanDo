#!/usr/bin/env bash
# Host tests for the launcher (lre/launcher). Builds it and the unit tests
# (unit.c) with $CC (default gcc) -std=c11 -Wall -Wextra -Werror, then runs
# it end to end in a temp image whose launch.conf points at a fake proot
# (fake-proot.sh prints its argv and the env vars we check, then
# fake-tracer.c runs the command and reports it on --status-fd the way our
# proot does). The real proot's side is proved by proot-test.sh.
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
"$cc" "${flags[@]}" -o "$launcher" "$src"/{conf,plan,relay,die,standin,main}.c
"$cc" "${flags[@]}" -I "$src" -o "$work/unit" "$here/unit.c" "$src"/{conf,plan,relay}.c
"$cc" "${flags[@]}" -o "$work/fake-tracer" "$here/fake-tracer.c"
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
# Extra KEY=VALUE words for the next run's environment (FAKE_* knobs).
extra=()

# The fixed environment of every run: PHONECANDO_IMAGE from $image (left out
# when empty), then $extra.
run_env() {
  vars=(PATH=/host/bin:/usr/bin:/bin "LD_PRELOAD=$work/libhook.so" LD_LIBRARY_PATH=/host/lib
    OPENCODE_SERVER_PASSWORD=hunter2 OPENCODE_SERVER_USERNAME=opencode KEEP_ME=kept
    "FAKE_TRACER=$work/fake-tracer")
  [[ -n $image ]] && vars+=("PHONECANDO_IMAGE=$image")
  vars+=("${extra[@]}")
}

# run DIR CMD...: CMD in DIR with run_env's environment; sets out, err,
# status and secs (whole seconds it took).
run() {
  local dir=$1 start=$SECONDS
  shift
  run_env
  status=0
  # The outer 2>/dev/null takes bash's own "Terminated" note for a run that
  # ends by a signal on purpose.
  { (cd "$dir" && env -i "${vars[@]}" "$@") >"$work/out" 2>"$work/err" || status=$?; } 2>/dev/null
  secs=$((SECONDS - start))
  out=$(cat "$work/out")
  err=$(cat "$work/err")
}

# start DIR CMD...: CMD in DIR in the background; its pid in pid (the
# launcher's own: the subshell and env exec into it).
start() {
  local dir=$1
  shift
  run_env
  (cd "$dir" && exec env -i "${vars[@]}" "$@") >"$work/out" 2>"$work/err" &
  pid=$!
}

# finish: waits for start's command; sets out, err and status like run.
finish() {
  status=0
  wait "$pid" || status=$?
  out=$(cat "$work/out")
  err=$(cat "$work/err")
}

# await FILE: up to 5 s for FILE to appear.
await() {
  local i
  for i in $(seq 50); do
    [[ -e $1 ]] && return 0
    sleep 0.1
  done
  echo "await: $1 never appeared" >&2
  return 1
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

# expect_status NAME STATUS WANT [ERR]: that status, stdout == WANT, stderr == ERR.
expect_status() {
  if [[ $status == "$2" && $out == "$3" && $err == "${4-}" ]]; then
    result ok "$1"
  else
    result fail "$1" "status $2, stdout:"$'\n'"$3"$'\n'"stderr: ${4-}"
  fi
}

# expect_error NAME MESSAGE: status 127, no stdout, stderr == our prefix + MESSAGE.
expect_error() {
  local want="phonecando-launch: $2"
  if [[ $status == 127 && -z $out && $err == "$want" ]]; then result ok "$1"; else result fail "$1" "$want"; fi
}

# The proot args every run of $img starts with, the status fd the launcher
# adds, and the env its guest gets.
proot_args="argv $work/proot
argv --rootfs=$img/rootfs
argv --bind=/data/app/x y:/opt/x y
argv --status-fd=FD"
guest_env="env PATH=/usr/local/bin:/usr/bin:/bin
env LD_PRELOAD unset
env LD_LIBRARY_PATH=/guest/lib
env OPENCODE_SERVER_PASSWORD unset
env OPENCODE_SERVER_USERNAME=opencode
env KEEP_ME=kept"
host_env="env PATH=/host/bin:/usr/bin:/bin
env LD_PRELOAD=$work/libhook.so
env LD_LIBRARY_PATH=/host/lib
env OPENCODE_SERVER_PASSWORD=hunter2
env OPENCODE_SERVER_USERNAME=opencode
env KEEP_ME=kept"
# What `bash -c x` prints for $img, before the command's own output.
bash_x="$proot_args
argv --cwd=/root
argv /bin/sh
argv -c
argv x
$guest_env"

run "$work" "$work/shims/git" status --short "two words"
expect_run 'symlinked shim: args, --status-fd, --cwd=home, command, forwarded args, env' "$proot_args
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

run "$work" "$launcher" -c x
expect_run 'own name runs bash, mapped to /bin/sh' "$bash_x"

# Leading a terminal's session, as the terminal tab's program does (script(1)
# runs us on a fresh PTY): the launcher lets the terminal go and asks proot
# to give the command a session of its own with it (--setsid).
if command -v script >/dev/null; then
  run "$work" script -qec "exec $launcher -c x" /dev/null
  out=$(tr -d '\r' <<<"$out")
  expect_run 'leading a terminal: --setsid' "${bash_x/argv --status-fd=FD/argv --status-fd=FD
argv --setsid}"
else
  echo "skip leading a terminal: no script(1)"
fi

image=$work/plain
run "$work/proj" "$launcher" -c 'echo x'
expect_run 'own name runs bash; no home means /' "argv $work/proot
argv --status-fd=FD
argv --cwd=/
argv bash
argv -c
argv echo x
$host_env"
image=$img

# --- standing in for the command (fake-tracer plays proot's side) ---

extra=('FAKE_MAIN=echo from the command; exit 3')
run "$work" "$launcher" -c x
expect_status "the command's exit code is the launcher's" 3 "$bash_x
from the command"

extra=('FAKE_MAIN=kill -TERM $$')
run "$work" "$launcher" -c x
expect_status "the command's death by a signal is the launcher's (143: SIGTERM)" 143 "$bash_x"

extra=('FAKE_MAIN=echo done' FAKE_LINGER=4)
run "$work" "$launcher" -c x
if [[ $status == 0 && $out == "$bash_x"$'\n'done && $secs -lt 2 ]]; then
  result ok 'returns when the command ends, while proot stays (4 s)'
else
  result fail 'returns when the command ends, while proot stays (4 s)' "status 0 in under 2 s (took ${secs}s)"
fi

extra=(FAKE_MODE=fail:1)
run "$work" "$launcher" -c x
expect_status 'proot fails before the command starts: its code and message' 1 "$bash_x" 'fake-tracer: cannot start'

extra=(FAKE_MODE=die:9)
run "$work" "$launcher" -c x
expect_status 'proot dies while the command runs: its death (137: SIGKILL)' 137 "$bash_x"

extra=("FAKE_MAIN=touch $work/ready; exec sleep 5")
rm -f "$work/ready"
start "$work" "$launcher" -c x
await "$work/ready" && kill -TERM "$pid"
finish
expect_status 'a signal for the launcher alone reaches the command (143)' 143 "$bash_x"

extra=(FAKE_MODE=slow "FAKE_MAIN=touch $work/ready; exec sleep 5")
rm -f "$work/ready"
start "$work" "$launcher" -c x
await "$work/ready" && kill -TERM "$pid"
finish
expect_status 'a signal before the command is reported reaches it once it is (143)' 143 "$bash_x"

# The command and the launcher share this script's process group: a signal
# from the command to the launcher must not come back to it.
extra=('FAKE_MAIN=trap "echo passed back" USR1; read -r _ _ _ l _ </proc/$PPID/stat; kill -USR1 "$l"; sleep 1; echo done')
run "$work" "$launcher" -c x
expect_status "a signal from the command's own group is not passed back" 0 "$bash_x
done"
extra=()

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
argv --status-fd=FD
argv --cwd=/
argv git
argv status
$host_env"

{ echo "$first"; printf '%*s\n' "$((pad + 1))" '' | tr ' ' '#'; } >"$conf"
run "$work" "$work/shims/git" status
expect_error 'oversize launch.conf' "$conf: over 256 KiB"

echo "launcher: $passed passed, $failed failed"
[[ $failed == 0 ]]
