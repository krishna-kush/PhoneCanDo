#!/usr/bin/env bash
# Lists the tracked scripts of one language, one path per line, for the lint
# jobs: by extension, plus extensionless files whose shebang names the
# interpreter (./manage is Python). Reads a NUL-separated file list on stdin:
#
#   git ls-files -z | bash .github/ci/lint/list-scripts.sh shell|python
set -euo pipefail

case "${1:-}" in
  shell)
    ext_re='\.(sh|bash)$'
    bang_re='^#!.*[/[:space:]](sh|bash|dash|ksh)([[:space:]]|$)'
    ;;
  python)
    ext_re='\.py$'
    bang_re='^#!.*[/[:space:]]python[0-9.]*([[:space:]]|$)'
    ;;
  *)
    echo "usage: git ls-files -z | $0 shell|python" >&2
    exit 2
    ;;
esac

# Owned by the tool that generates it (Gradle wrapper): never hand-edited.
skip_re='^pce/gradlew$'

while IFS= read -r -d '' f; do
  if [[ $f =~ $skip_re ]]; then
    continue
  fi
  base=${f##*/}
  if [[ $base =~ $ext_re ]]; then
    printf '%s\n' "$f"
  elif [[ $base != *.* && -f $f && ! -L $f ]]; then
    first=''
    IFS= read -r first < "$f" || true
    if [[ $first =~ $bang_re ]]; then
      printf '%s\n' "$f"
    fi
  fi
done
