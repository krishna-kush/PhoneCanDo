package com.phonecando.lre.tar.layer

import com.phonecando.lre.api.LreException

/** What an OCI whiteout marker asks for. */
internal sealed interface Whiteout {
    /** `.wh.<name>`: remove `<name>` (file or tree) that lower layers left in this dir. */
    class Remove(val name: String) : Whiteout

    /** `.wh..wh..opq`: hide everything lower layers left in this dir. */
    object Opaque : Whiteout

    /** Other `.wh..wh.*` names and aufs' `/.wh..wh.plnk/` link dir: bookkeeping, not ours to apply. */
    object Ignored : Whiteout

    companion object {
        private const val PREFIX = ".wh."
        private const val META_PREFIX = ".wh..wh."
        private const val OPAQUE = ".wh..wh..opq"

        /** The marker member [parts] stands for, or null for an ordinary member. */
        fun parse(parts: List<String>, entry: String): Whiteout? {
            if (parts.size > 1 && parts.first().startsWith(META_PREFIX)) return Ignored
            val baseName = parts.last()
            if (!baseName.startsWith(PREFIX)) return null
            if (baseName == OPAQUE) return Opaque
            if (baseName.startsWith(META_PREFIX)) return Ignored
            val name = baseName.substring(PREFIX.length)
            if (name.isEmpty() || name == "." || name == "..") throw LreException.UnsafeEntry(entry, "bad whiteout")
            return Remove(name)
        }
    }
}
