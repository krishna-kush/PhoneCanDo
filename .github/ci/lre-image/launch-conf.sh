#!/usr/bin/env bash
# Write <image>/run/launch.conf for a Tier 1 run, by hand, following the
# contract in lre/launcher/src/conf.h. A stand-in for the app's own writer,
# lre/image's conf/LaunchConf.kt (the lre CLI's `setup --tarball` runs it),
# so this workflow tests the image, not our Kotlin; keep the two in step.
# Left out: the fake /proc files (only Android hides the real ones) and
# more than one data-dir spelling.
#
#   proot      -L --link2symlink --sysvipc -0 --kernel-release (no --kill-on-exit:
#              background processes outlive their command, as on the phone;
#              the launcher adds --status-fd itself, so the command returns
#              when it ends)
#   binds      rootfs at /, host /dev /proc /sys, /dev/random and the fd
#              links, run/shm at /dev/shm; home/ at /root and tmp/ at /tmp,
#              each also at its own path; run/l2s at its own path
#              (link2symlink's symlinks name host paths in PROOT_L2S_DIR:
#              unbound, every hardlinked file reads as missing and git
#              cannot commit)
#   env        PROOT_LOADER (unbundled loader), PROOT_TMP_DIR, PROOT_L2S_DIR
#              (run/), guest PATH, SHELL, USER, LOGNAME, LANG; host LD_* and
#              the engine's secrets dropped (the names the app passes for
#              opencode); HOME and TMPDIR stay host paths
#   same/home  a cwd under home/ or tmp/ stays the guest cwd, anything else
#              is /root
#
# Usage: launch-conf.sh <image-dir> <lib-dir>
#   <image-dir>  PHONECANDO_IMAGE: rootfs/, home/, tmp/, run/
#   <lib-dir>    libproot.so and libproot-loader.so (the APK's native-lib dir
#                on a phone)
# Env: QEMU (optional, local runs only) a qemu-user binary, e.g.
#      /usr/bin/qemu-aarch64-static: proot runs every guest program through
#      it (--qemu), so the arm64 image can be tried on an x86_64 host. CI
#      runs on arm64 and never sets it.
set -euo pipefail

IMG="$(cd "${1:?usage: launch-conf.sh <image-dir> <lib-dir>}" && pwd -P)"
LIB="$(cd "${2:?usage: launch-conf.sh <image-dir> <lib-dir>}" && pwd -P)"

qemu=""
if [ -n "${QEMU-}" ]; then
  qemu="arg --qemu=$(command -v "$QEMU")" || { echo "launch-conf: no QEMU '$QEMU'" >&2; exit 1; }
fi

cat > "$IMG/run/launch.conf" <<EOF
# Tier 1 (CI): hand-written by .github/ci/lre-image/launch-conf.sh.
arg $LIB/libproot.so
${qemu:-# (guest programs run natively)}
arg -L
arg --link2symlink
arg --sysvipc
arg -0
arg --kernel-release=6.1.0-phonecando
arg --rootfs=$IMG/rootfs
arg --bind=/dev
arg --bind=/proc
arg --bind=/sys
arg --bind=/dev/urandom:/dev/random
arg --bind=/proc/self/fd:/dev/fd
arg --bind=/proc/self/fd/0:/dev/stdin
arg --bind=/proc/self/fd/1:/dev/stdout
arg --bind=/proc/self/fd/2:/dev/stderr
arg --bind=$IMG/run/shm:/dev/shm
arg --bind=$IMG/home:/root
arg --bind=$IMG/tmp:/tmp
arg --bind=$IMG/home:$IMG/home
arg --bind=$IMG/tmp:$IMG/tmp
arg --bind=$IMG/run/l2s:$IMG/run/l2s
unset LD_*
unset OPENCODE_SERVER_PASSWORD
unset PHONECANDO_BRIDGE_TOKEN
unset PHONECANDO_BRIDGE_URL
set PROOT_LOADER=$LIB/libproot-loader.so
set PROOT_TMP_DIR=$IMG/run/proot-tmp
set PROOT_L2S_DIR=$IMG/run/l2s
set PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
set SHELL=/bin/bash
set USER=root
set LOGNAME=root
set LANG=C.UTF-8
same $IMG/home
same $IMG/tmp
home /root
EOF
echo "wrote $IMG/run/launch.conf"
