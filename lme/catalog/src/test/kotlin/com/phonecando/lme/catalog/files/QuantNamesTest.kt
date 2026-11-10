package com.phonecando.lme.catalog.files

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class QuantNamesTest {
    @Test
    fun `quant names from real file names`() {
        val cases = mapOf(
            "Qwen3.5-4B-Q4_K_M.gguf" to "Q4_K_M",
            "gemma-4-E2B-it-IQ4_XS.gguf" to "IQ4_XS",
            "Qwen3.5-4B-UD-Q4_K_XL.gguf" to "UD-Q4_K_XL",
            "Q4_K_M/Qwen3.5-122B-A10B-Q4_K_M-00001-of-00003.gguf" to "Q4_K_M",
            "Meta-Llama-3-8B-Instruct.Q5_K_M.gguf" to "Q5_K_M",
            "phi-4-q8_0.gguf" to "Q8_0",
            "gemma-4-E2B-it-BF16.gguf" to "BF16",
            "gpt-oss-20b-MXFP4.gguf" to "MXFP4",
            "model-TQ1_0.gguf" to "TQ1_0",
        )
        for ((name, quant) in cases) assertEquals(quant, QuantNames.of(name), name)
    }

    @Test
    fun `names without a quant`() {
        for (name in listOf("model.gguf", "Qwen3.5-4B.gguf", "E2B-A10B-4B.gguf", "x-Q4.gguf")) {
            assertEquals(null, QuantNames.of(name), name)
        }
    }
}
