package com.phonecando.lre.tar.path

import com.phonecando.lre.api.LreException

/**
 * Archive paths (member names, hard-link targets) to guest-relative
 * components: `./` and duplicate slashes dropped, `..` folded lexically,
 * absolute names and anything that climbs above the root rejected.
 */
internal object EntryPath {
    fun parse(name: String): List<String> {
        if (name.startsWith('/')) throw LreException.UnsafeEntry(name, "absolute path")
        if (name.indexOf('\u0000') >= 0) throw LreException.UnsafeEntry(name, "NUL in path")
        val parts = ArrayList<String>()
        for (part in name.split('/')) {
            when (part) {
                "", "." -> Unit
                ".." -> {
                    if (parts.isEmpty()) throw LreException.UnsafeEntry(name, "leaves the root")
                    parts.removeAt(parts.lastIndex)
                }
                else -> parts += part
            }
        }
        return parts
    }

    fun utf8Length(text: String): Int = text.toByteArray(Charsets.UTF_8).size
}
