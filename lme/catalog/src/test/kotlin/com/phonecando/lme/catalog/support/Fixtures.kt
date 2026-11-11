package com.phonecando.lme.catalog.support

/**
 * Recorded Hugging Face API responses under src/test/resources/catalog/,
 * fetched once with curl (public API, no token) on 2026-11-09 (the
 * `origin-*` lookups on 2026-11-10); the tree listings are trimmed to a few entries and long model card texts (a
 * licence) cut short. Each file ends in one newline, which [text] drops.
 */
object Fixtures {
    fun text(path: String): String {
        val raw = Fixtures::class.java.getResourceAsStream("/catalog/$path")?.use { it.readBytes() }
            ?: error("missing fixture $path")
        return raw.decodeToString().removeSuffix("\n")
    }

    const val QWEN_4B = "unsloth/Qwen3.5-4B-GGUF"
    const val QWEN_4B_SHA = "e87f176479d0855a907a41277aca2f8ee7a09523"
    const val GEMMA_E2B = "unsloth/gemma-4-E2B-it-GGUF"
    const val QWEN_122B = "unsloth/Qwen3.5-122B-A10B-GGUF"
    const val QWEN_122B_SHA = "51eab4d59d53f573fb9206cb3ce613f1d0aa392b"
}
