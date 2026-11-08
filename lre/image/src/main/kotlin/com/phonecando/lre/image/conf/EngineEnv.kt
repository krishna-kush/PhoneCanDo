package com.phonecando.lre.image.conf

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import java.io.File

/**
 * Builds `run/engine.env` exactly as [ImageLayout] specifies: `KEY=VALUE`
 * lines, no quotes, no expansion. Pure.
 */
internal object EngineEnv {
    /** HOME, TMPDIR, SHELL (shims/bash), PATH (shims/ then Android's), PHONECANDO_IMAGE and MAKEFLAGS. */
    fun linux(layout: ImageLayout, host: HostEnv): String = render(
        base(layout) + listOf(
            "SHELL" to File(layout.shims, "bash").path,
            "PATH" to listOf(layout.shims.path, host.hostPath).filter { it.isNotEmpty() }.joinToString(":"),
            "PHONECANDO_IMAGE" to layout.root.path,
            // A default cap on make's parallel jobs: Android kills an app's
            // processes past a device-wide limit (OsNote.PHANTOM). Here, not in
            // launch.conf, so a command that sets its own MAKEFLAGS keeps it.
            "MAKEFLAGS" to "-j4",
        ),
    )

    /** An image with no Linux: HOME and TMPDIR only. */
    fun android(layout: ImageLayout): String = render(base(layout))

    private fun base(layout: ImageLayout) = listOf("HOME" to layout.home.path, "TMPDIR" to layout.tmp.path)

    private fun render(pairs: List<Pair<String, String>>): String = pairs.joinToString("") { (key, value) ->
        if (value.any { it == '\n' || it == '\r' || it == '\u0000' }) {
            throw LreException.UnsafeEntry(value, "a line break or NUL cannot go into engine.env")
        }
        "$key=$value\n"
    }
}
