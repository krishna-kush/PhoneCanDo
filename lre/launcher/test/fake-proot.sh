#!/bin/sh
# Stands in for proot in the launcher tests (run.sh): prints its argv, one
# per line (--status-fd=N as --status-fd=FD once N is an open fd), then the
# environment variables the tests check. Then, given a status fd and
# $FAKE_TRACER, it execs fake-tracer (fake-tracer.c), which runs
# `sh -c "$FAKE_MAIN"` as the command and reports it the way proot does
# (mode $FAKE_MODE, default report; staying $FAKE_LINGER seconds after).
# Without them it exits 0 and reports nothing. Builtins only up to there:
# the launcher may have replaced PATH.
fd=
for a in "$0" "$@"; do
  case $a in
  --status-fd=*)
    fd=${a#--status-fd=}
    if eval "true >&$fd" 2>/dev/null; then a=--status-fd=FD; fi
    ;;
  esac
  printf 'argv %s\n' "$a"
done
for v in PATH LD_PRELOAD LD_LIBRARY_PATH OPENCODE_SERVER_PASSWORD OPENCODE_SERVER_USERNAME KEEP_ME; do
  if eval "[ -n \"\${$v+x}\" ]"; then
    eval "printf 'env %s=%s\n' $v \"\$$v\""
  else
    printf 'env %s unset\n' "$v"
  fi
done
[ -n "$fd" ] && [ -n "${FAKE_TRACER-}" ] || exit 0
exec "$FAKE_TRACER" "$fd" "${FAKE_MODE:-report}" "${FAKE_LINGER:-0}" sh -c "${FAKE_MAIN:-:}"
