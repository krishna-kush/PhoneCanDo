package com.phonecando.lme.store.support

import com.phonecando.lme.gguf.testkit.GgufBytes

/** Small but valid model files: a GGUF header plus some fake tensor data. */
object TestModels {
    fun gguf(
        name: String = "Tiny",
        splitCount: Long? = null,
        padding: Int = 3000,
        baseRepoUrl: String? = null,
        contextLength: Long? = null,
    ): ByteArray {
        val header = GgufBytes()
            .string("general.architecture", "llama")
            .string("general.name", name)
            .u32("llama.block_count", 2)
            .u32("llama.embedding_length", 64)
            .u32("llama.attention.head_count", 4)
            .u32("general.file_type", 15)
            .apply { if (splitCount != null) u32("split.count", splitCount) }
            .apply { if (baseRepoUrl != null) string("general.base_model.0.repo_url", baseRepoUrl) }
            .apply { if (contextLength != null) u32("llama.context_length", contextLength) }
            .tensor("w", 8, 8)
            .build()
        return header + ByteArray(padding) { (it % 251).toByte() }
    }
}
