#!/usr/bin/env bash
# shellcheck shell=bash
# Static talloc for proot, sourced by the lre/proot entry scripts (not run on
# its own).
#
#   talloc_build <talloc-src> <out-dir>
#       compiles talloc.c (plus our rep_memset_explicit) into
#       <out-dir>/lib/libtalloc.a and copies talloc.h to <out-dir>/include.
#
# We compile talloc.c directly with a hand-written config.h (../talloc/)
# instead of running talloc's waf build: waf needs python plus a cross-answers
# file to cross-compile, and builds libreplace, a shared lib and python
# bindings proot never uses. Static, because a libtalloc.so.2 SONAME cannot
# ship as an Android jniLib.
#
# Env in (set by the entry script):
#   CC          compiler command (may carry flags, e.g. --target=...)
#   AR, NM      archiver and symbol lister for the target
#   CFLAGS_TARGET  target flags shared with the proot build (prefix map etc.)

talloc_build() {
  local src="$1" out="$2" obj cfgdir major minor release undef
  local -a cc cflags defs
  read -r -a cc <<<"$CC"
  read -r -a cflags <<<"$CFLAGS_TARGET"
  cfgdir="$PROOT_DIR/talloc"
  IFS=. read -r major minor release <<<"$TALLOC_VERSION"
  obj="$out/obj"
  rm -rf "$out"
  mkdir -p "$obj" "$out/lib" "$out/include"

  # -D__STDC_WANT_LIB_EXT1__ and -D_GNU_SOURCE are what waf puts on every
  # talloc compile line (replace.h #errors without the former).
  defs=(
    -D_GNU_SOURCE -D__STDC_WANT_LIB_EXT1__=1
    "-DTALLOC_BUILD_VERSION_MAJOR=$major"
    "-DTALLOC_BUILD_VERSION_MINOR=$minor"
    "-DTALLOC_BUILD_VERSION_RELEASE=$release"
    -I"$cfgdir" -I"$src" -I"$src/lib/replace"
  )
  "${cc[@]}" -O2 -fPIC -Wall "${cflags[@]}" "${defs[@]}" -c "$src/talloc.c" -o "$obj/talloc.o"
  "${cc[@]}" -O2 -fPIC -Wall "${cflags[@]}" -c "$cfgdir/memset_explicit.c" -o "$obj/memset_explicit.o"

  # A HAVE_* config.h missed turns a libc call into rep_<name>, which nothing
  # defines: fail here, not with a confusing proot link error.
  undef="$("$NM" -u "$obj/talloc.o" | awk '{print $NF}' | grep '^rep_' | grep -vx 'rep_memset_explicit' || true)"
  if [ -n "$undef" ]; then
    echo "talloc FAIL: unresolved libreplace symbols (add HAVE_* to talloc/config.h?): $undef" >&2
    return 1
  fi

  # D: zero timestamps/uids in the archive.
  "$AR" rcsD "$out/lib/libtalloc.a" "$obj/talloc.o" "$obj/memset_explicit.o"
  cp "$src/talloc.h" "$out/include/talloc.h"
}
