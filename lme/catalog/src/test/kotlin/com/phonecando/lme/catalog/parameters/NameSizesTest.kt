package com.phonecando.lme.catalog.parameters

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class NameSizesTest {
    private fun size(name: String): Long? = NameSizes.of(name)?.count

    // Repository names from the Hub's GGUF lists (2026-11-10).
    @Test
    fun `plain sizes, any case, decimals`() {
        assertEquals(
            listOf(27_000_000_000L, 800_000_000L, 1_500_000_000L, 4_000_000_000L, 120_000_000_000L, 1_000_000_000L),
            listOf(
                "unsloth/Qwen3.8-27B-GGUF",
                "unsloth/Qwen3.5-0.8B-GGUF",
                "ThorOdinson246/nl2sh-1.5b-Q4_K_M",
                "XHToken/Spark-X2.6-4B-GGUF",
                "ggml-org/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-GGUF",
                "lmstudio-community/gemma-3-1b-it-GGUF",
            ).map(::size),
        )
    }

    @Test
    fun `millions and trillions`() {
        assertEquals(135_000_000L, size("bartowski/SmolLM2-135M-Instruct-GGUF"))
        assertEquals(270_000_000L, size("unsloth/gemma-3-270m-it-GGUF"))
        assertEquals(1_000_000_000_000L, size("inclusionAI/Ling-1T"))
    }

    @Test
    fun `an MoE is its total, never its active part`() {
        assertEquals(35_000_000_000L, size("unsloth/Qwen3.6-35B-A3B-GGUF"))
        assertEquals(26_000_000_000L, size("farbodtavakkoli/OTel-2.0-Decision-26B-A4B-4bit"))
        assertEquals(30_000_000_000L, size("bartowski/Qwen3-30B-A3B-Instruct-2507-GGUF"))
        // Active first, total second: the larger is the total.
        assertEquals(7_000_000_000L, size("allenai/OLMoE-1B-7B-0924"))
        // Only an active size: no total in the name.
        assertEquals(null, size("Qwen/Qwen1.5-MoE-A2.7B-Chat"))
        assertEquals(null, size("InternScience/Sage-A1.5-Q4_K_M-GGUF"))
    }

    @Test
    fun `experts times their size`() {
        assertEquals(56_000_000_000L, size("TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF"))
        assertEquals(176_000_000_000L, size("bartowski/WizardLM-2-8x22B-GGUF"))
    }

    @Test
    fun `Gemma's E sizes are their effective size, marked`() {
        assertEquals(ParameterCount(2_000_000_000L, effective = true), NameSizes.of("unsloth/gemma-4-E2B-it-GGUF"))
        assertEquals(ParameterCount(4_000_000_000L, effective = true), NameSizes.of("ggml-org/gemma-3n-e4b-it-GGUF"))
        assertEquals(ParameterCount(12_000_000_000L), NameSizes.of("unsloth/gemma-4-12b-it-GGUF"))
    }

    @Test
    fun `quants, versions, dates, bits and contexts are not sizes`() {
        assertEquals(
            listOf<Long?>(null, null, null, null, null, null, null),
            listOf(
                "unsloth/Qwen3.8-Flash-Next-GGUF",
                "Abiray/DeepSeek-V4.1-Flash-1017-Uncensored-GSQ-RCO-IQ2_XXS-GGUF",
                "acme/model-Q4_K_M-BF16-v2",
                "acme/Phi-3-mini-128k-instruct-4bit",
                "acme/LFM2.5-VL",
                "acme/Model-2025-12",
                "stabilityai/stablelm-2-1_6b",
            ).map(::size),
        )
        assertEquals(7_000_000_000L, size("Qwen/Qwen2.5-7B-Instruct-1M"))
        assertEquals(null, size("acme/Text-01-1M"))
        assertEquals(1_200_000_000L, size("LiquidAI/LFM2.5-1.2B-Instruct-GGUF"))
    }

    @Test
    fun `only the name after the owner counts`() {
        assertEquals(null, size("7B-labs/chat"))
        assertEquals(8_000_000_000L, size("Llama-3.1-8B"))
    }
}
