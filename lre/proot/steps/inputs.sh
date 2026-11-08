#!/usr/bin/env bash
# shellcheck shell=bash
# What decides the bytes of an Android proot build, sourced by the lre/proot
# entry scripts (not run on its own).
#
#   inputs_digest   one sha256 over pins.env (the NDK and every download),
#                   patches/, steps/, talloc/ and build-android.sh
#
# build-android.sh writes it to <out-dir>/INPUTS, stage.sh copies it next to
# the staged libs, and ensure.sh compares it with this tree's to tell a
# staged build of these inputs from an out-of-date one.
# Needs PROOT_DIR (steps/sources.sh sets it).

inputs_digest() {
  (cd "$PROOT_DIR" && find pins.env build-android.sh patches steps talloc -type f -print0 \
    | LC_ALL=C sort -z | xargs -0 sha256sum) | sha256sum | cut -d' ' -f1
}
