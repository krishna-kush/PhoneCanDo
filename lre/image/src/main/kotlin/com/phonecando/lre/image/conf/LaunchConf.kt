package com.phonecando.lre.image.conf

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.PayloadNames
import com.phonecando.lre.image.detect.Detection
import com.phonecando.lre.image.proc.FakeProc
import java.io.File

/**
 * Builds `run/launch.conf`, how our launcher starts proot for one image
 * (contract: lre/launcher/src/conf.h). Pure: paths in, text out.
 *
 * - proot flags are proot-distro's proven set; binds give the guest /dev,
 *   /proc, /sys, the fd links, a per-image /dev/shm and our fake /proc files.
 * - home/ and tmp/ are bound at `/root` and `/tmp` and at their own host
 *   path under every data-dir spelling, each listed as a `same` path: the
 *   engine's file tools see host paths and its commands must see the same
 *   ones. run/l2s is bound at its own path too, because link2symlink writes
 *   absolute host paths into it inside the links it makes.
 * - HOME and TMPDIR stay as the engine set them (host paths, bound in the
 *   guest). PATH, SHELL, USER and LOGNAME are the guest's; LANG is C.UTF-8
 *   unless the image sets it; the image config's other variables pass on.
 * - TERM is never set: launch.conf cannot say "only when absent", and the
 *   terminal's PTY sets its own while engine commands have no terminal.
 * - Secrets the engine holds (and any LD_* the app process has) are unset.
 */
internal object LaunchConf {
    const val MAX_BYTES = 256 * 1024
    const val MAX_LINES = 4096
    const val GUEST_HOME = "/root"

    val UNSET = listOf("LD_*", "OPENCODE_SERVER_PASSWORD", "PHONECANDO_BRIDGE_TOKEN", "PHONECANDO_BRIDGE_URL")

    private const val HEADER = "# Written by PhoneCanDo image setup before every engine start " +
        "(format: lre/launcher/src/conf.h). Edits are lost.\n"

    // No --kill-on-exit: like on a PC, what a command starts in the background
    // (a dev server, a database) keeps running after it returns. The launcher
    // adds --status-fd (and --setsid on a terminal) itself, so the command
    // returns when it ends while proot traces the rest (launcher.md). Stopping
    // the engine reaps the agent's processes by PHONECANDO_AGENT, and a reset
    // or delete reaps the image's by PHONECANDO_IMAGE (both kept in the guest).
    private val PROOT_FLAGS = listOf(
        "-L", "--link2symlink", "--sysvipc", "-0",
        "--kernel-release=${FakeProc.KERNEL_RELEASE}",
    )

    private val DEVICE_BINDS = listOf(
        "/dev", "/proc", "/sys",
        "/dev/urandom:/dev/random",
        "/proc/self/fd:/dev/fd",
        "/proc/self/fd/0:/dev/stdin",
        "/proc/self/fd/1:/dev/stdout",
        "/proc/self/fd/2:/dev/stderr",
    )

    fun build(layout: ImageLayout, host: HostEnv, detection: Detection): String =
        render(directives(layout, host, detection))

    fun directives(layout: ImageLayout, host: HostEnv, detection: Detection): List<Directive> {
        val lib = host.libDir.trimEnd('/')
        val home = layout.home.path
        val tmp = layout.tmp.path
        val l2s = layout.l2s.path
        val homes = PathSpellings.of(home, host.dataDirSpellings)
        val tmps = PathSpellings.of(tmp, host.dataDirSpellings)

        val args = buildList {
            add("$lib/${PayloadNames.PROOT}")
            addAll(PROOT_FLAGS)
            add("--rootfs=${layout.rootfs.path}")
            DEVICE_BINDS.forEach { add("--bind=$it") }
            add(bind(layout.shm.path, "/dev/shm"))
            FakeProc.NAMES.forEach { add(bind(File(layout.fakeProc, it).path, "/proc/$it")) }
            add(bind(home, GUEST_HOME))
            add(bind(tmp, "/tmp"))
            homes.forEach { add(bind(home, it)) }
            tmps.forEach { add(bind(tmp, it)) }
            add(bind(l2s, l2s))
        }
        val env = buildList {
            add("PROOT_LOADER" to "$lib/${PayloadNames.LOADER}")
            add("PROOT_TMP_DIR" to layout.prootTmp.path)
            add("PROOT_L2S_DIR" to l2s)
            add("PATH" to detection.guestPath)
            add("SHELL" to detection.shell)
            add("USER" to "root")
            add("LOGNAME" to "root")
            if (detection.imageEnv.none { it.first == "LANG" }) add("LANG" to "C.UTF-8")
            addAll(detection.imageEnv)
        }
        return buildList {
            args.forEach { add(Directive.Arg(it)) }
            UNSET.forEach { add(Directive.Unset(it)) }
            env.forEach { (key, value) -> add(Directive.SetEnv(key, value)) }
            if (!detection.hasBash) add(Directive.MapCommand("bash", detection.shell))
            if (!detection.hasSh) add(Directive.MapCommand("sh", detection.shell))
            (homes + tmps).forEach { add(Directive.Same(it)) }
            add(Directive.Home(GUEST_HOME))
        }
    }

    /** The file text; throws [LreException.TooLarge] past the launcher's limits. */
    fun render(directives: List<Directive>): String {
        val first = directives.firstOrNull { it is Directive.Arg } as Directive.Arg?
            ?: throw LreException.UnsafeEntry("launch.conf", "no arg line")
        Directive.absolute(first.value)
        val text = buildString {
            append(HEADER)
            directives.forEach { append(it.line()).append('\n') }
        }
        if (directives.size + 1 > MAX_LINES) throw LreException.TooLarge("launch.conf", MAX_LINES.toLong(), "lines")
        if (text.toByteArray(Charsets.UTF_8).size > MAX_BYTES) {
            throw LreException.TooLarge("launch.conf", MAX_BYTES.toLong())
        }
        return text
    }

    /** `--bind=SRC:DST`; proot splits at the first ':', so neither side may hold one. */
    private fun bind(source: String, dest: String): String {
        for (path in listOf(source, dest)) {
            Directive.absolute(path)
            if (':' in path) throw LreException.UnsafeEntry(path, "':' cannot go into a proot bind")
        }
        return "--bind=$source:$dest"
    }
}
