#!/bin/sh
# Node.js for Alpine (runtime.json `install` "apk"): the distro's own nodejs
# and npm. nodejs.org builds only for glibc, so a musl image takes Alpine's
# package. It must be Node 22 or newer (runtime.json `provides`), which
# Alpine 3.21 and later ship; an older Alpine fails here with its version.
#
# Idempotent: a node of that major or newer with npm beside it is kept, and
# `apk add` leaves installed packages as they are.
set -eu

WANT_MAJOR=22

say() { printf 'node: %s\n' "$*"; }
die() {
  printf 'node: %s\n' "$*" >&2
  exit 1
}
major() { node --version 2>/dev/null | sed -n 's/^v\([0-9][0-9]*\)\..*/\1/p'; }
ready() {
  m="$(major)"
  [ -n "$m" ] && [ "$m" -ge "$WANT_MAJOR" ] && command -v npm >/dev/null 2>&1
}

if ready; then
  say "$(node --version) is already installed"
  exit 0
fi

apk add nodejs npm

m="$(major)"
[ -n "$m" ] || die "node does not run after apk add nodejs npm"
[ "$m" -ge "$WANT_MAJOR" ] ||
  die "this Alpine's nodejs is $(node --version); agents need Node $WANT_MAJOR or newer (Alpine 3.21 and later)"
command -v npm >/dev/null 2>&1 || die "npm is missing after apk add nodejs npm"
say "$(node --version) from Alpine's packages"
