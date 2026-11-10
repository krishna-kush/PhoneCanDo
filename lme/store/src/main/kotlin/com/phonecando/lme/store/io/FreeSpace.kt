package com.phonecando.lme.store.io

import java.io.File

/** Free bytes for new files under a dir; the default asks the file system. */
fun interface FreeSpace {
    fun bytes(dir: File): Long

    companion object {
        val FILE_SYSTEM = FreeSpace { dir -> generateSequence(dir) { it.parentFile }.first { it.exists() }.usableSpace }
    }
}
