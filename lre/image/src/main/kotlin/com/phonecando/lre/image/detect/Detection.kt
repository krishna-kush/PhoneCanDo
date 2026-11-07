package com.phonecando.lre.image.detect

import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.api.OsInfo

/**
 * What setup learned from one unpacked base, kept in `run/image.properties`
 * so every later start can rewrite the run files without the base.
 *
 * We always run commands as (fake) root, so package managers work; the
 * config's user and working dir are recorded, not applied: the guest cwd is
 * the engine's own (a `same` path) or `/root`.
 */
internal data class Detection(
    val os: OsInfo,
    val config: ImageConfig?,
    /** The guest has `bash` on its PATH; otherwise launch.conf maps bash to [OsInfo.shell]. */
    val hasBash: Boolean,
    /** The guest has `sh` on its PATH (or fixups link it); otherwise launch.conf maps sh to [OsInfo.shell]. */
    val hasSh: Boolean,
    /** Guest path of busybox in an image with no shell link: fixups link `/bin/sh` to it. */
    val busyboxSh: String?,
) {
    val guestPath: String get() = ImageEnv.guestPath(config)
    val imageEnv: List<Pair<String, String>> get() = ImageEnv.exported(config)

    /** [OsInfo.shell] is never null for a detected Linux image. */
    val shell: String get() = os.shell ?: error("a detected image always has a shell")
}
