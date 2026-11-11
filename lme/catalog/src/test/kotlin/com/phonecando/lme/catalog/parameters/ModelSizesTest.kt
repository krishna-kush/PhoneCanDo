package com.phonecando.lme.catalog.parameters

import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelSize
import com.phonecando.lme.catalog.support.Fixtures
import com.phonecando.network.testkit.FakePort
import com.phonecando.network.testkit.reply
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ModelSizesTest {
    private val none: (String) -> Long? = { null }

    @Test
    fun `the repository's name, then its original's name, then the original's checkpoint`() {
        val checkpoints = mapOf("Qwen/Qwen3.8-Flash-Next" to 179_999_981_459L, "Qwen/Qwen3.5-2B" to 2_274_069_824L)
        assertEquals(ParameterCount(2_000_000_000L), ModelSizes.of("unsloth/Qwen3.5-2B-GGUF", "Qwen/Qwen3.5-2B", checkpoints::get))
        assertEquals(ParameterCount(9_000_000_000L), ModelSizes.of("acme/Coder-GGUF", "acme/Coder-9B", checkpoints::get))
        assertEquals(ParameterCount(179_999_981_459L), ModelSizes.of("unsloth/Qwen3.8-Flash-Next-GGUF", "Qwen/Qwen3.8-Flash-Next", checkpoints::get))
        assertNull(ModelSizes.of("acme/Coder-GGUF", "acme/Coder", none))
        assertNull(ModelSizes.of("acme/Coder-GGUF", "acme/Coder") { 0L })
    }

    @Test
    fun `a lookup only for an original that no name sizes`() {
        assertNull(ModelSizes.lookupFor("unsloth/Qwen3.8-27B-GGUF", "Qwen/Qwen3.8-27B"))
        assertNull(ModelSizes.lookupFor("acme/Coder-GGUF", "acme/Coder-9B"))
        assertNull(ModelSizes.lookupFor("ornith-ai/Ornith-GGUF", "ornith-ai/Ornith-GGUF"))
        assertEquals("Qwen/Qwen3.8-Flash-Next", ModelSizes.lookupFor("unsloth/Qwen3.8-Flash-Next-GGUF", "Qwen/Qwen3.8-Flash-Next"))
    }

    // The Hub's "2B to 5B" (num_parameters, recorded 2026-11-09) let a 27B model in; by our sizes it stays out.
    @Test
    fun `the buckets keep a model by its size`() {
        val fake = FakePort()
        fake.onPrefix("https://huggingface.co/api/models?") { reply(200, Fixtures.text("filtered-gguf.json")) }
        val hits = HfCatalog(fake).search("", ModelFilters(size = ModelSize.FROM_2B_TO_5B), limit = 5).hits
        assertEquals(
            listOf("ccore/Qwen3.5-4B-3D-Coder", "ccore/Qwen3.5-4B-GLB-3D-Coder", "XHToken/Spark-X2.6-4B-GGUF", "HauhauCS/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive"),
            hits.filter { ModelSize.FROM_2B_TO_5B.holds(ModelSizes.of(it.repo, it.origin, none)) }.map { it.repo },
        )
    }

    @Test
    fun `bucket edges`() {
        fun buckets(count: Long, effective: Boolean = false) = ModelSize.entries.filter { it.holds(ParameterCount(count, effective)) }
        assertEquals(listOf(ModelSize.UP_TO_2B), buckets(135_000_000L))
        assertEquals(listOf(ModelSize.UP_TO_2B), buckets(2_000_000_000L))
        assertEquals(listOf(ModelSize.UP_TO_2B), buckets(2_000_000_000L, effective = true))
        assertEquals(listOf(ModelSize.FROM_2B_TO_5B), buckets(2_274_069_824L))
        assertEquals(listOf(ModelSize.FROM_2B_TO_5B), buckets(5_000_000_000L))
        assertEquals(listOf(ModelSize.FROM_5B_TO_10B), buckets(9_000_000_000L))
        assertEquals(listOf(ModelSize.FROM_5B_TO_10B), buckets(10_000_000_000L))
        assertEquals(listOf(ModelSize.OVER_10B), buckets(10_000_000_001L))
        assertEquals(emptyList(), ModelSize.entries.filter { it.holds(null) })
    }
}
