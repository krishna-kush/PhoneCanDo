package com.phonecando.lme.gguf.testkit

/** Synthetic headers shaped like real models (values from their GGUF files). */
object Models {
    /** Qwen3.5-4B: hybrid, a KV cache on every 4th of 32 layers. */
    fun qwen35(): GgufBytes = GgufBytes()
        .string("general.architecture", "qwen35")
        .string("general.name", "Qwen3.5-4B")
        .string("general.base_model.0.name", "Qwen3.5 4B")
        .string("general.base_model.0.organization", "Qwen")
        .string("general.base_model.0.repo_url", "https://huggingface.co/Qwen/Qwen3.5-4B")
        .u32("qwen35.block_count", 32)
        .u32("qwen35.context_length", 262144)
        .u32("qwen35.embedding_length", 2560)
        .u32("qwen35.attention.head_count", 16)
        .u32("qwen35.attention.head_count_kv", 4)
        .u32("qwen35.attention.key_length", 256)
        .u32("qwen35.attention.value_length", 256)
        .u32("qwen35.full_attention_interval", 4)
        .strings("tokenizer.ggml.tokens", count = 5000, length = 6)
        .u32("general.file_type", 15)

    /** Gemma 4 E2B: 35 layers, the last 20 share caches, 4 of every 5 windowed. */
    fun gemma4(): GgufBytes = GgufBytes()
        .string("general.architecture", "gemma4")
        .string("general.name", "Gemma-4-E2B-It")
        .string("general.base_model.0.name", "Gemma 4 E2B It")
        .string("general.base_model.0.organization", "Google")
        .u32("gemma4.block_count", 35)
        .u32("gemma4.context_length", 131072)
        .u32("gemma4.embedding_length", 1536)
        .u32("gemma4.attention.head_count", 8)
        .u32("gemma4.attention.head_count_kv", 1)
        .u32("gemma4.attention.key_length", 512)
        .u32("gemma4.attention.value_length", 512)
        .u32("gemma4.attention.sliding_window", 512)
        .u32("gemma4.attention.shared_kv_layers", 20)
        .bools("gemma4.attention.sliding_window_pattern", List(35) { it % 5 != 4 })
        .u32("gemma4.attention.key_length_swa", 256)
        .u32("gemma4.attention.value_length_swa", 256)
        .u32("general.file_type", 15)
}
