package com.phonecando.lme.catalog.files

/**
 * llama.cpp's split-file names: `<stem>-00001-of-00003.gguf`. llama.cpp
 * opens the first part and finds the rest next to it by this name. Pure.
 */
object Shards {
    private val PART = Regex("^(.*)-([0-9]{5})-of-([0-9]{5})\\.gguf$", RegexOption.IGNORE_CASE)

    /** Part [index] of [count] (both from 1), or null for an unsplit file name. */
    data class Part(val stem: String, val index: Int, val count: Int)

    fun part(fileName: String): Part? {
        val m = PART.matchEntire(fileName) ?: return null
        val index = m.groupValues[2].toInt()
        val count = m.groupValues[3].toInt()
        if (count < 1 || index !in 1..count) return null
        return Part(m.groupValues[1], index, count)
    }

    /** [fileName] without a part suffix, `.gguf` kept. */
    fun stem(fileName: String): String = part(fileName)?.let { "${it.stem}.gguf" } ?: fileName
}
