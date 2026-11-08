package com.phonecando.lre.api

import java.io.File

/**
 * Where one image lives: `<filesDir>/images/<id>/` (keep ids short: Unix
 * socket paths inside home/ and tmp/ are capped at 108 bytes).
 *
 * The engine host (the runner module) knows only this layout and the files
 * under `run/` listed here; everything else is the runtime's own.
 *
 * - `run/launch.conf`: read by our launcher (contract: lre/launcher/src/conf.h).
 * - `run/engine.env`: the engine's environment for this image, one
 *   `KEY=VALUE` per line, no quotes, no expansion. Always `HOME` and `TMPDIR`
 *   (host paths of home/ and tmp/). A Linux image adds `SHELL` (shims/bash),
 *   `PATH` (shims/ first, then Android's default), `PHONECANDO_IMAGE`
 *   (root) and `MAKEFLAGS` (`-j4`, a default parallel-jobs cap). The runner applies every line over its own environment when it
 *   starts the engine, and tags the engine with the agent separately.
 * - `run/os-note.md`: a line or two for the agent's instructions (OS and
 *   version, package manager and its install command, no systemd, what a
 *   SIGKILL from Android's process limit means). Absent
 *   for an Android image.
 *
 * The runtime's own `run/` files (lre/image): `setup-state` (finished setup
 * steps), `image.properties` (detected OS and tools), `reset-swap` (present
 * only while a reset swaps rootfs) and `reinstall.txt` (packages to offer
 * after a reset; read it with lre/image's ReinstallList).
 */
class ImageLayout(val root: File) {
    /** The Linux system; absent for an Android image. Replaced whole on reset. */
    val rootfs: File get() = File(root, "rootfs")

    /** The agent's and the user's home: projects, agent config, chats, keys. Survives reset. */
    val home: File get() = File(root, "home")
    val tmp: File get() = File(root, "tmp")
    val run: File get() = File(root, "run")
    val shims: File get() = File(root, "shims")
    val logs: File get() = File(root, "logs")

    val launchConf: File get() = File(run, "launch.conf")
    val engineEnv: File get() = File(run, "engine.env")
    val osNote: File get() = File(run, "os-note.md")

    /** Fake /proc entries Android won't let apps read (loadavg, stat, uptime, version, vmstat). */
    val fakeProc: File get() = File(run, "proc")

    /** Per-image dir bound at /dev/shm. */
    val shm: File get() = File(run, "shm")
    val prootTmp: File get() = File(run, "proot-tmp")

    /** link2symlink's `.l2s.*` files, kept out of projects. */
    val l2s: File get() = File(run, "l2s")
}

/** File names of the Linux payload in the APK's native-library dir. */
object PayloadNames {
    const val PROOT = "libproot.so"
    const val LOADER = "libproot-loader.so"
    const val LAUNCHER = "libphonecando_launch.so"
}
