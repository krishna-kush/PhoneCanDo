#!/usr/bin/env bash
# The launcher with a real proot build (ours, patched: --status-fd), proving
# that commands in a Linux image behave as on a PC when they leave processes
# running: the command returns when it ends, with its own status, while its
# background jobs and daemons keep running, traced, where a later command
# can see and kill them; nothing of ours holds the caller's pipes.
#
#   returns at once       (sleep &); echo hi: hi at once, status 0, sleep alive
#   pipe end-of-file      $(...) of that returns at once too
#   holder keeps the pipe sleep 2 & echo hi: the launcher returns at once,
#                         end-of-file comes when the sleep ends (as on a PC)
#   exit code             exit 7 -> 7
#   signal deaths         kill -TERM $$ -> 143, kill -KILL $$ -> 137
#   daemon                setsid sleep in a double fork survives, own session
#   later command         kill -0 sees the job's pid, kill ends it
#   stopped job           kill -STOP from a later command stops the job
#                         until kill -CONT (proot 0003: parked, /proc state
#                         t, not running on)
#   proot behind          the tracer left behind is out of our session,
#                         holds /dev/null as stdio, and takes its tracees
#                         with it when killed (PTRACE_O_EXITKILL)
#   terminal (needs bash, head, seq and stty in the rootfs; script(1) and
#                         python3 on the host)
#                         twice: on a terminal the launcher's session holds
#                         (script(1)) and on a free one, as the app's
#                         terminal tab opens it (python3). Each time the
#                         shell leads the terminal's session; Ctrl-C
#                         ends the foreground job, not the shell; Ctrl-Z
#                         stops the job for real (bash says Stopped and
#                         /proc says T or t), fg resumes it, Ctrl-Z and bg
#                         resume it in the background; a background job
#                         reading the terminal (SIGTTIN) or writing it
#                         under stty tostop (SIGTTOU) stops too; closing
#                         the terminal hangs up the shell's jobs, a nohup'd
#                         one survives
#
# Usage: proot-test.sh <proot-dir> <rootfs> [<scratch>]
#   <proot-dir>  libproot.so + libproot-loader.so for this host
#                (lre/proot/build-glibc.sh)
#   <rootfs>     a rootfs for this host's arch with sh, sleep, kill and
#                setsid (CI: pins.env's Alpine minirootfs; locally / works)
#   <scratch>    emptied and used for the image dir: empty, or one an
#                earlier run used (default: a temp dir, removed at the end)
# Env: CC (default gcc). Prints ok/FAIL lines; exit 1 on any FAIL.
set -uo pipefail
export LC_ALL=C

usage="usage: proot-test.sh <proot-dir> <rootfs> [<scratch>]"
PROOT="$(cd "${1:?$usage}" && pwd -P)" || exit 2
ROOTFS="$(cd "${2:?$usage}" && pwd -P)" || exit 2
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
src=$here/../src
temp=""
if [ -n "${3-}" ]; then
  mkdir -p "$3" && work=$(cd "$3" && pwd -P) || exit 2
  if [ -n "$(ls -A "$work")" ] && [ ! -e "$work/.lre-proot-test" ]; then
    echo "proot-test: $work is not empty and not an earlier run's scratch" >&2
    exit 2
  fi
  find "$work" -mindepth 1 -delete
else
  temp=$(mktemp -d "${TMPDIR:-/tmp}/lre-proot-test.XXXXXX") && work=$(cd "$temp" && pwd -P) || exit 2
fi
touch "$work/.lre-proot-test"

img=$work/img
launcher=$work/libphonecando_launch.so
mkdir -p "$img/run/proot-tmp" "$img/run/l2s" "$work/shims"
"${CC:-gcc}" -std=c11 -O2 -Wall -Wextra -Werror -o "$launcher" "$src"/{conf,plan,relay,die,standin,main}.c || exit 1
ln -s "$launcher" "$work/shims/sh"
ln -s "$launcher" "$work/shims/bash"
cat >"$img/run/launch.conf" <<EOF
arg $PROOT/libproot.so
arg -L
arg --link2symlink
arg --sysvipc
arg -0
arg --kernel-release=6.1.0-phonecando
arg --rootfs=$ROOTFS
arg --bind=/dev
arg --bind=/proc
arg --bind=/sys
arg --bind=$img/run/l2s:$img/run/l2s
unset LD_*
set PROOT_LOADER=$PROOT/libproot-loader.so
set PROOT_TMP_DIR=$img/run/proot-tmp
set PROOT_L2S_DIR=$img/run/l2s
set PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
home /
EOF

passed=0 failed=0
# Pids of guest processes we start on purpose: killed at the end, whatever happened.
leftovers=()
cleanup() {
  local p
  for p in "${leftovers[@]}"; do kill -KILL "$p" 2>/dev/null; done
  [ -n "$temp" ] && rm -rf -- "$temp"
}
trap cleanup EXIT

ok() {
  passed=$((passed + 1))
  echo "ok   $1"
}
bad() {
  failed=$((failed + 1))
  echo "FAIL $1"
  echo "  $2"
}
now_ms() { echo $(($(date +%s%N) / 1000000)); }

# guest COMMAND: `sh -c COMMAND` through the shim, as an engine runs one;
# sets out (stdout and stderr), status and ms (until the pipe's end-of-file).
guest() {
  local start
  start=$(now_ms)
  out=$(cd "$work" && env -i PATH=/usr/bin:/bin "PHONECANDO_IMAGE=$img" "$work/shims/sh" -c "$1" 2>&1)
  status=$?
  ms=$(($(now_ms) - start))
}

# state_of PID: the letter of its State in /proc (empty when gone).
state_of() { sed -n 's/^State:[[:space:]]*\(.\).*/\1/p' "/proc/$1/status" 2>/dev/null; }

# alive PID: running (not gone, not a zombie).
alive() {
  local state
  state=$(state_of "$1")
  [ -n "$state" ] && [ "$state" != Z ] && [ "$state" != X ]
}

# switches_of PID: how often it was scheduled out so far.
switches_of() { awk '/ctxt_switches/ { n += $2 } END { print n }' "/proc/$1/status" 2>/dev/null; }

# held PID: stopped within 3 s, then not scheduled at all for 0.5 s: a job
# that proot keeps stopping and restarting shows stopped now and then too.
# proot parks a stopped job (PTRACE_LISTEN), which /proc shows as t
# (tracing stop), not T.
held() {
  local before
  for _ in $(seq 30); do
    case $(state_of "$1") in
      [Tt])
        sleep 0.3
        before=$(switches_of "$1")
        sleep 0.5
        case $(state_of "$1") in [Tt]) ;; *) return 1 ;; esac
        [ -n "$before" ] && [ "$(switches_of "$1")" = "$before" ]
        return
        ;;
    esac
    sleep 0.1
  done
  return 1
}

# going PID: running again (R or S) within 3 s.
going() {
  for _ in $(seq 30); do
    case $(state_of "$1") in [RS]) return 0 ;; esac
    sleep 0.1
  done
  return 1
}

# gone PID: not alive within 3 s.
gone() {
  for _ in $(seq 30); do
    alive "$1" || return 0
    sleep 0.1
  done
  return 1
}

# pid_of ARGS: the pid of the one live process whose argv is exactly ARGS.
pid_of() {
  local d want
  want=$(printf '%s\0' "$@" | tr '\0' ' ')
  for d in /proc/[0-9]*; do
    { [ "$(tr '\0' ' ' <"$d/cmdline")" = "$want" ]; } 2>/dev/null && alive "${d#/proc/}" && echo "${d#/proc/}" && return 0
  done
  return 1
}

tracer_of() { sed -n 's/^TracerPid:[[:space:]]*//p' "/proc/$1/status" 2>/dev/null; }
parent_of() { awk '{print $4}' "/proc/$1/stat" 2>/dev/null; }
session_of() { awk '{print $6}' "/proc/$1/stat" 2>/dev/null; }

echo "proot: $("$PROOT/libproot.so" -V 2>&1 | grep -m1 -o '[0-9][0-9.]*' || echo '?'), rootfs: $ROOTFS"

# --- returns when the command ends ---
guest '(sleep 471 >/dev/null 2>&1 &); echo hi'
bg=$(pid_of sleep 471) && leftovers+=("$bg")
if [ "$status" = 0 ] && [ "$out" = hi ] && [ "$ms" -lt 3000 ]; then
  ok "(sleep 471 &); echo hi: hi, status 0 and end-of-file in ${ms} ms"
else
  bad "(sleep 471 &); echo hi" "status $status in ${ms} ms, output: $out"
fi
if [ -n "$bg" ]; then ok "the background sleep runs on (pid $bg)"; else bad "the background sleep runs on" "no live 'sleep 471'"; fi

# --- a background job that holds stdout: the pipe waits for it, the launcher does not ---
start=$(now_ms)
{
  (cd "$work" && env -i PATH=/usr/bin:/bin "PHONECANDO_IMAGE=$img" "$work/shims/sh" -c 'sleep 2 & echo hi')
  echo "$(($(now_ms) - start))" >"$work/exit-ms"
} | cat >"$work/held"
eof=$(($(now_ms) - start))
exit_ms=$(cat "$work/exit-ms")
if [ "$exit_ms" -lt 1500 ] && [ "$eof" -ge 1800 ] && [ "$(cat "$work/held")" = hi ]; then
  ok "sleep 2 & echo hi: returned in ${exit_ms} ms, end-of-file after ${eof} ms (the sleep held stdout)"
else
  bad "sleep 2 & echo hi" "returned in ${exit_ms} ms, end-of-file after ${eof} ms, output: $(cat "$work/held")"
fi

# --- exit codes and signal deaths ---
guest 'exit 7'
if [ "$status" = 7 ]; then ok "exit 7: status 7"; else bad "exit 7" "status $status: $out"; fi
guest 'kill -TERM $$'
if [ "$status" = 143 ]; then ok 'kill -TERM $$: status 143'; else bad 'kill -TERM $$' "status $status: $out"; fi
guest 'kill -KILL $$'
if [ "$status" = 137 ]; then ok 'kill -KILL $$: status 137'; else bad 'kill -KILL $$' "status $status: $out"; fi

# --- a daemon: double fork, new session ---
guest '( (setsid sleep 472 </dev/null >/dev/null 2>&1 &) & ); echo started'
daemon=$(pid_of sleep 472) && leftovers+=("$daemon")
if [ "$status" = 0 ] && [ "$out" = started ] && [ -n "$daemon" ] && [ "$(session_of "$daemon")" = "$daemon" ]; then
  ok "a setsid daemon survives its command in its own session (pid $daemon, ${ms} ms)"
else
  bad "a setsid daemon survives its command" "status $status in ${ms} ms, pid '${daemon}', output: $out"
fi

# --- a later command sees the job and ends it ---
guest 'sleep 473 >/dev/null 2>&1 & echo $!'
job=$out
[ -n "$job" ] && leftovers+=("$job")
guest "kill -0 $job && [ -d /proc/$job ] && echo seen"
if [ "$out" = seen ]; then ok "a later command sees the job (pid $job)"; else bad "a later command sees the job" "status $status: $out"; fi
guest "kill $job && echo sent"
if [ "$out" = sent ] && gone "$job"; then ok "a later command kills it"; else bad "a later command kills it" "status $status: $out"; fi

# --- a stopped job stays stopped until SIGCONT ---
guest 'sleep 470 >/dev/null 2>&1 & echo $!'
job=$out
[ -n "$job" ] && leftovers+=("$job")
guest "kill -STOP $job"
if [ -n "$job" ] && held "$job"; then
  ok "kill -STOP from a later command stops the job (state $(state_of "$job"))"
else
  bad "kill -STOP from a later command stops the job" "pid '${job}', state '$(state_of "$job")'"
fi
guest "kill -CONT $job"
if [ -n "$job" ] && going "$job"; then ok "kill -CONT resumes it"; else bad "kill -CONT resumes it" "state '$(state_of "$job")'"; fi
guest "kill $job"

# --- the proot left behind ---
tracer=$(tracer_of "$bg")
if [ -n "$tracer" ] && [ "$tracer" != 0 ]; then
  fds=$(for f in 0 1 2; do readlink "/proc/$tracer/fd/$f"; done | sort -u | tr '\n' ' ')
  if [ "$fds" = "/dev/null " ]; then ok "the proot behind holds only /dev/null as stdio"; else bad "the proot behind holds only /dev/null as stdio" "fds 0-2: $fds"; fi
  if [ "$(session_of "$tracer")" != "$(session_of $$)" ]; then
    ok "the proot behind left our session"
  else
    bad "the proot behind left our session" "session $(session_of "$tracer")"
  fi
  kill -KILL "$tracer"
  if gone "$bg"; then ok "killing it ends its tracees (PTRACE_O_EXITKILL)"; else bad "killing it ends its tracees" "sleep 471 ($bg) still alive"; fi
else
  bad "the proot behind" "no tracer for sleep 471 ($bg)"
fi

# --- a terminal: job control, Ctrl-C and hangup (bash in the rootfs) ---
# A PTY that is no session's controlling terminal, the way the app's
# terminal tab opens one for the launcher (handOver), so the guest shell
# takes it. Like script(1), it owns the master: killing it closes the
# master, as closing the terminal tab does.
free_tty_py='
import os, select, sys
master, slave = os.openpty()
if os.fork() == 0:
    os.setsid()
    for fd in (0, 1, 2):
        os.dup2(slave, fd)
    os.closerange(3, 1024)
    os.execv(sys.argv[1], sys.argv[1:])
os.close(slave)
fds = [0, master]
while True:
    for fd in select.select(fds, [], [])[0]:
        try:
            data = os.read(fd, 4096)
        except OSError:
            data = b""
        if fd == master and not data:
            sys.exit(0)
        if not data:
            fds.remove(0)
        else:
            os.write(master if fd == 0 else 1, data)
'

# shown FILE COUNT PATTERN: FILE has COUNT lines matching PATTERN within 3 s.
shown() {
  for _ in $(seq 30); do
    [ "$(grep -c "$3" "$1")" -ge "$2" ] && return 0
    sleep 0.1
  done
  return 1
}

# terminal_checks LABEL N OPENER...: an interactive bash through the shim on
# the PTY OPENER owns; this run's sleeps are N to N+3, its head and seq N+4
# and N+5.
terminal_checks() {
  local label=$1 n=$2 fifo out term fg hup nohup shell stop job p
  shift 2
  fifo=$work/tty-in-$n
  out=$work/tty-out-$n
  mkfifo "$fifo"
  # Job control (set -m) for this one start, or bash would start it with
  # SIGINT ignored, and every program in the terminal would inherit that.
  set -m
  (cd "$work" && exec env -i PATH=/usr/bin:/bin TERM=dumb "PHONECANDO_IMAGE=$img" "$@" <"$fifo" >"$out" 2>&1) &
  term=$!
  set +m
  exec 9>"$fifo"
  printf 'sleep %d & nohup sleep %d >/dev/null 2>&1 & sleep %d\n' "$n" $((n + 1)) $((n + 2)) >&9
  fg=""
  for _ in $(seq 50); do fg=$(pid_of sleep $((n + 2))) && break; sleep 0.1; done
  hup=$(pid_of sleep "$n")
  nohup=$(pid_of sleep $((n + 1)))
  for p in "$fg" "$hup" "$nohup"; do [ -n "$p" ] && leftovers+=("$p"); done
  shell=$(parent_of "$hup")
  if [ -n "$shell" ] && [ "$(session_of "$shell")" = "$shell" ]; then
    ok "$label: the shell leads the terminal's session (pid $shell)"
  else
    bad "$label: the shell leads the terminal's session" "shell '${shell}', session '$(session_of "$shell")'"
  fi
  printf '\003' >&9
  if [ -n "$fg" ] && gone "$fg"; then
    printf 'echo after-$((6 * 7))\n' >&9
    for _ in $(seq 50); do grep -q after-42 "$out" && break; sleep 0.1; done
  fi
  if grep -q after-42 "$out"; then
    ok "$label: Ctrl-C ends the foreground job, the shell goes on"
  else
    bad "$label: Ctrl-C ends the foreground job, the shell goes on" "$(tail -c 300 "$out" | tr -cd '[:print:]\n')"
  fi
  printf 'sleep %d\n' $((n + 3)) >&9
  stop=""
  for _ in $(seq 50); do stop=$(pid_of sleep $((n + 3))) && break; sleep 0.1; done
  [ -n "$stop" ] && leftovers+=("$stop")
  # Ctrl-Z: the shell says Stopped and the job really is, not running on.
  printf '\032' >&9
  if [ -n "$stop" ] && shown "$out" 1 "Stopped.*sleep $((n + 3))" && held "$stop"; then
    ok "$label: Ctrl-Z stops the job (bash: Stopped, state $(state_of "$stop"))"
  else
    bad "$label: Ctrl-Z stops the job" "state '$(state_of "$stop")': $(tail -c 300 "$out" | tr -cd '[:print:]\n')"
  fi
  printf 'fg\n' >&9
  if [ -n "$stop" ] && going "$stop"; then
    ok "$label: fg resumes it"
  else
    bad "$label: fg resumes it" "state '$(state_of "$stop")': $(tail -c 300 "$out" | tr -cd '[:print:]\n')"
  fi
  printf '\032' >&9
  if [ -n "$stop" ] && shown "$out" 2 "Stopped.*sleep $((n + 3))" && held "$stop" \
    && printf 'bg\n' >&9 && going "$stop"; then
    ok "$label: Ctrl-Z stops it again, bg resumes it in the background"
  else
    bad "$label: Ctrl-Z stops it again, bg resumes it in the background" "state '$(state_of "$stop")': $(tail -c 300 "$out" | tr -cd '[:print:]\n')"
  fi
  printf 'fg\n' >&9
  sleep 0.5
  printf '\003' >&9
  if [ -n "$stop" ] && gone "$stop"; then
    ok "$label: fg and Ctrl-C end it"
  else
    bad "$label: fg and Ctrl-C end it" "state '$(state_of "$stop")': $(tail -c 300 "$out" | tr -cd '[:print:]\n')"
  fi
  # A background job that reads the terminal stops (SIGTTIN), and so does
  # one that writes it under stty tostop (SIGTTOU).
  printf 'head -c %d &\n' $((n + 4)) >&9
  job=""
  for _ in $(seq 50); do job=$(pid_of head -c $((n + 4))) && break; sleep 0.1; done
  [ -n "$job" ] && leftovers+=("$job")
  if [ -n "$job" ] && held "$job"; then
    ok "$label: a background job reading the terminal stops (state $(state_of "$job"))"
  else
    bad "$label: a background job reading the terminal stops" "pid '${job}', state '$(state_of "$job")'"
  fi
  printf 'kill -KILL $!; stty tostop; seq %d &\n' $((n + 5)) >&9
  job=""
  for _ in $(seq 50); do job=$(pid_of seq $((n + 5))) && break; sleep 0.1; done
  [ -n "$job" ] && leftovers+=("$job")
  if [ -n "$job" ] && held "$job"; then
    ok "$label: a background job writing the terminal under tostop stops (state $(state_of "$job"))"
  else
    bad "$label: a background job writing the terminal under tostop stops" "pid '${job}', state '$(state_of "$job")'"
  fi
  printf 'kill -KILL $!; stty -tostop\n' >&9
  # As closing the terminal tab: the master goes away with its owner.
  kill -KILL "$term"
  exec 9>&-
  wait "$term" 2>/dev/null
  if [ -n "$hup" ] && gone "$hup"; then ok "$label: closing the terminal hangs up the shell's job"; else bad "$label: closing the terminal hangs up the shell's job" "sleep $n '${hup}' still alive"; fi
  if [ -n "$nohup" ] && alive "$nohup"; then ok "$label: a nohup'd job survives the hangup"; else bad "$label: a nohup'd job survives the hangup" "sleep $((n + 1)) '${nohup}' gone"; fi
}

if [ -x "$ROOTFS/bin/bash" ] || [ -x "$ROOTFS/usr/bin/bash" ]; then
  # The launcher leads the session that holds the terminal and lets it go.
  # script(1) runs the command through /bin/sh -c; exec makes the launcher
  # that session's leader even where sh stays as a parent (dash, on CI).
  if command -v script >/dev/null; then
    terminal_checks "held terminal" 474 script -qfec "exec $work/shims/bash --norc --noprofile -i" /dev/null
  else
    echo "skip held-terminal checks: no script(1) on this host"
  fi
  # The launcher leads a session without one: the app's terminal tab.
  if command -v python3 >/dev/null; then
    terminal_checks "free terminal" 484 python3 -c "$free_tty_py" "$work/shims/bash" --norc --noprofile -i
  else
    echo "skip free-terminal checks: no python3 on this host"
  fi
else
  echo "skip terminal checks: no bash in $ROOTFS"
fi

echo "proot-test: $passed passed, $failed failed"
[ "$failed" = 0 ]
