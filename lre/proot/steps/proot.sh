#!/usr/bin/env bash
# shellcheck shell=bash
# proot + its loader, sourced by the lre/proot entry scripts (not run on its
# own).
#
#   proot_build <proot-tree> <talloc-out> <out-dir>
#       runs upstream's src/GNUmakefile in <proot-tree> and writes the
#       stripped <out-dir>/libproot.so and <out-dir>/libproot-loader.so.
#
# Upstream make knobs we set, and why:
#   PROOT_UNBUNDLE_LOADER  the loader is NOT embedded in proot. Bundled, proot
#       writes it to PROOT_TMP_DIR and execs it there, which Android's W^X
#       forbids for app data. Unbundled, proot execs $PROOT_LOADER (we ship it
#       as libproot-loader.so in the APK's native-library dir). The value is
#       only the fallback dir used when PROOT_LOADER is unset; ours names the
#       mistake, since no install path is fixed on Android.
#   HAS_LOADER_32BIT=      no 32-bit loader: we ship arm64 guests only, and a
#       -m32 build is impossible on arm64 hosts and needs multilib on x86_64.
#       A 32-bit guest binary then fails to exec (PROOT_LOADER_32 unset).
#   GIT=false              VERSION comes from pins.env, never from
#       `git describe` of whatever repo the workdir happens to sit in.
#   OBJCOPY/OBJDUMP=false  only used to embed the loader; must not run.
#
# Env in (set by the entry script):
#   CC, STRIP             target compiler command and strip
#   CFLAGS_TARGET, CPPFLAGS_TARGET, LDFLAGS_TARGET
#   LOADER_CFLAGS_TARGET, LOADER_LDFLAGS_TARGET   extra flags for the loader
#       (freestanding, static, fixed address: no stack protector, own
#       page-size flags)
#   MAKE_VARS_TARGET      extra make command-line VAR=value words (optional)
# Host tools: make, GNU awk and readelf (upstream's loader-info rule for
# aarch64 parses `readelf -s` with gawk-only awk).

PROOT_LOADER_FALLBACK=/PROOT_LOADER-unset

proot_build() {
  local tree="$1" talloc="$2" out="$3" tools gawk_bin jobs feature
  local -a strip make_vars
  read -r -a strip <<<"$STRIP"
  read -r -a make_vars <<<"${MAKE_VARS_TARGET:-}"

  tools="$tree/.build-tools"
  mkdir -p "$tools" "$out"
  if awk --version 2>/dev/null | grep -q 'GNU Awk'; then
    :
  elif gawk_bin="$(command -v gawk)"; then
    ln -sf "$gawk_bin" "$tools/awk"
  else
    echo "proot FAIL: GNU awk (gawk) is required (upstream's loader-info.awk)" >&2
    return 1
  fi
  command -v readelf >/dev/null || { echo "proot FAIL: readelf (binutils) is required" >&2; return 1; }
  jobs="$(nproc 2>/dev/null || echo 2)"

  # Upstream appends its own flags (+=) to these, so they go in as
  # environment, not as make command-line overrides (which would win).
  env PATH="$tools:$PATH" \
    CC="$CC" STRIP="$STRIP" OBJCOPY=false OBJDUMP=false \
    CFLAGS="$CFLAGS_TARGET" \
    CPPFLAGS="-I$talloc/include $CPPFLAGS_TARGET" \
    LDFLAGS="-L$talloc/lib $LDFLAGS_TARGET" \
    LOADER_CFLAGS="$LOADER_CFLAGS_TARGET" \
    LOADER_LDFLAGS="$LOADER_LDFLAGS_TARGET" \
    make -C "$tree/src" -j"$jobs" V=1 \
      GIT=false HAS_LOADER_32BIT= PROOT_UNBUNDLE_LOADER="$PROOT_LOADER_FALLBACK" \
      "${make_vars[@]}" proot

  # The feature probes link tiny programs with our flags and fail silently;
  # a proot without them still builds but loses seccomp acceleration and
  # process_vm fast paths. Insist on both.
  for feature in HAVE_PROCESS_VM HAVE_SECCOMP_FILTER; do
    if ! grep -q "^#define $feature\$" "$tree/src/build.h"; then
      echo "proot FAIL: $feature missing from build.h (feature probe failed to link?)" >&2
      return 1
    fi
  done
  if ! grep -aqF "$PROOT_LOADER_FALLBACK/loader" "$tree/src/proot"; then
    echo "proot FAIL: proot was not built with PROOT_UNBUNDLE_LOADER" >&2
    return 1
  fi

  install -m 0755 "$tree/src/proot" "$out/libproot.so"
  install -m 0755 "$tree/src/loader/loader" "$out/libproot-loader.so"
  "${strip[@]}" --strip-all "$out/libproot.so" "$out/libproot-loader.so"
}
