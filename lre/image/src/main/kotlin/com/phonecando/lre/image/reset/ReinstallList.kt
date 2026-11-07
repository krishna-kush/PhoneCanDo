package com.phonecando.lre.image.reset

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.image.files.TextFiles
import java.io.File

/**
 * `run/reinstall.txt`: the packages installed by hand before a reset and
 * the one shell line that installs them again, so the UI can offer it.
 * Lines are `command <shell line>` then one `package <name>` each; names
 * are plain package names, safe on a shell line as they are.
 */
data class ReinstallList(val installCommand: String, val packages: List<String>) {
    fun encode(): String = "command $installCommand\n" + packages.joinToString("") { "package $it\n" }

    companion object {
        fun file(layout: ImageLayout): File = File(layout.run, "reinstall.txt")

        /** The list a reset left, or null when there is none. */
        fun read(layout: ImageLayout): ReinstallList? = TextFiles.read(file(layout))?.let(::decode)

        /** Forgets the list, once the user reinstalled or dismissed it. */
        fun clear(layout: ImageLayout) = TextFiles.delete(file(layout))

        fun decode(text: String): ReinstallList? {
            var command: String? = null
            val packages = ArrayList<String>()
            for (line in text.lineSequence()) {
                when {
                    line.startsWith("command ") -> command = line.removePrefix("command ")
                    line.startsWith("package ") -> packages += line.removePrefix("package ")
                }
            }
            return command?.takeIf { packages.isNotEmpty() }?.let { ReinstallList(it, packages) }
        }
    }
}
