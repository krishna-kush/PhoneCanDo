package com.phonecando.lme.store.ids

import com.phonecando.lme.api.model.ModelIds

/**
 * New model ids from file names: `Qwen3.5-4B-Q4_K_M.gguf` becomes
 * `qwen3-5-4b-q4-k-m`, the next free one `qwen3-5-4b-q4-k-m-2`. Pure.
 */
internal object IdMaker {
    private val PART = Regex("-[0-9]{5}-of-[0-9]{5}$")
    private const val FALLBACK = "model"

    /** [fileName] without folder, `.gguf` and a split-part suffix. */
    fun stem(fileName: String): String =
        fileName.substringAfterLast('/').substringAfterLast('\\').replace(Regex("(?i)\\.gguf$"), "").replace(PART, "")

    fun unique(fileName: String, taken: Set<String>): String {
        val base = slug(stem(fileName))
        if (base !in taken) return base
        var n = 2
        while (true) {
            val suffix = "-$n"
            val id = base.take(ModelIds.MAX_LENGTH - suffix.length).trimEnd('-') + suffix
            if (id !in taken) return id
            n++
        }
    }

    private fun slug(text: String): String {
        val words = text.lowercase().split(Regex("[^a-z0-9]+")).filter { it.isNotEmpty() }
        val id = words.joinToString("-").take(ModelIds.MAX_LENGTH).trimEnd('-')
        return id.ifEmpty { FALLBACK }
    }
}
