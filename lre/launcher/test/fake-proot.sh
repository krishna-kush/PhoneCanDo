#!/bin/sh
# Stands in for proot in the launcher tests (run.sh): prints its argv, one
# per line, then the environment variables the tests check. Builtins only:
# the launcher may have replaced PATH.
for a in "$0" "$@"; do
  printf 'argv %s\n' "$a"
done
for v in PATH LD_PRELOAD LD_LIBRARY_PATH OPENCODE_SERVER_PASSWORD OPENCODE_SERVER_USERNAME KEEP_ME; do
  if eval "[ -n \"\${$v+x}\" ]"; then
    eval "printf 'env %s=%s\n' $v \"\$$v\""
  else
    printf 'env %s unset\n' "$v"
  fi
done
