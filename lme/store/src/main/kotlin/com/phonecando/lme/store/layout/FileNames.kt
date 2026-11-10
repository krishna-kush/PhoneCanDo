package com.phonecando.lme.store.layout

import com.phonecando.lme.api.LmeException

/** Names of files inside a model's dir: plain, visible, and never one of ours. Pure. */
internal object FileNames {
    private const val MAX_BYTES = 255

    fun isPlain(name: String): Boolean =
        name.isNotEmpty() && name.toByteArray(Charsets.UTF_8).size <= MAX_BYTES &&
            !name.startsWith('.') && !name.endsWith(ModelLayout.PART) &&
            name.none { it == '/' || it == '\\' || it.code < 0x20 || it.code == 0x7f }

    /** [name] itself when plain. @throws LmeException.InvalidName otherwise. */
    fun check(name: String): String {
        if (!isPlain(name)) throw LmeException.InvalidName(name, "a model file name is one plain file name")
        return name
    }
}
