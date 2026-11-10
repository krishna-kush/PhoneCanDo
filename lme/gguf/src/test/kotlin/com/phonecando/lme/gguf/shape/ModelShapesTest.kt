package com.phonecando.lme.gguf.shape

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.BaseModelRef
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.gguf.read.GgufReader
import com.phonecando.lme.gguf.testkit.GgufBytes
import com.phonecando.lme.gguf.testkit.Models
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.ByteArrayInputStream
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ModelShapesTest {
    private fun shape(bytes: GgufBytes) = ModelShapes.of(GgufReader.read(ByteArrayInputStream(bytes.build())))

    @Test
    fun `qwen3_5 keeps a cache on every 4th layer only`() {
        val s = shape(Models.qwen35().tensor("w", 10, 10))
        assertEquals("qwen35", s.architecture)
        assertEquals("Qwen3.5-4B", s.name)
        assertEquals("Q4_K_M", s.quant)
        assertEquals(100, s.parameterCount)
        assertEquals(262144, s.contextLength)
        assertEquals(32, s.blockCount)
        assertEquals(2560, s.embeddingLength)
        // 8 layers x 4 kv heads x (256 + 256)
        assertEquals(KvCacheShape(16384, 0, null), s.kvCache)
        assertEquals(BaseModelRef("Qwen3.5 4B", "Qwen", "https://huggingface.co/Qwen/Qwen3.5-4B"), s.baseModel)
    }

    @Test
    fun `the base model is what the header names, and nothing when it names nothing`() {
        assertEquals(BaseModelRef("Gemma 4 E2B It", "Google", null), shape(Models.gemma4()).baseModel)
        val plain = GgufBytes().string("general.architecture", "llama").u32("llama.block_count", 2)
        assertNull(shape(plain).baseModel)
        assertNull(shape(plain.string("general.base_model.0.name", "  ")).baseModel)
    }

    @Test
    fun `gemma 4 shares the last layers and windows four of five`() {
        // Layers 0..14 own a cache; of those 4, 9, 14 are full, 12 are windowed.
        assertEquals(KvCacheShape(3 * 1 * 1024L, 12 * 1 * 512L, 512), shape(Models.gemma4()).kvCache)
    }

    @Test
    fun `a plain model defaults head sizes from the embedding`() {
        val s = shape(
            GgufBytes()
                .string("general.architecture", "llama")
                .u32("llama.block_count", 2)
                .u32("llama.embedding_length", 4096)
                .u32("llama.attention.head_count", 32),
        )
        // kv heads default to heads; 4096 / 32 = 128 per head for keys and values
        assertEquals(KvCacheShape(2 * 32 * 256L, 0, null), s.kvCache)
        assertNull(s.name)
        assertNull(s.quant)
        assertNull(s.parameterCount)
        assertNull(s.contextLength)
    }

    @Test
    fun `per-layer kv heads, zeros for recurrent layers`() {
        val s = shape(
            GgufBytes()
                .string("general.architecture", "jamba")
                .u32("jamba.block_count", 4)
                .u32s("jamba.attention.head_count", listOf(8, 8, 8, 8))
                .u32s("jamba.attention.head_count_kv", listOf(0, 2, 0, 2))
                .u32("jamba.attention.key_length", 64),
        )
        assertEquals(KvCacheShape(2 * 2 * 128L, 0, null), s.kvCache)
    }

    @Test
    fun `a numeric window pattern makes every Pth layer full`() {
        val s = shape(
            GgufBytes()
                .string("general.architecture", "gemma3")
                .u32("gemma3.block_count", 6)
                .u32("gemma3.attention.head_count", 4)
                .u32("gemma3.attention.head_count_kv", 1)
                .u32("gemma3.attention.key_length", 10)
                .u32("gemma3.attention.sliding_window", 1024)
                .u32("gemma3.attention.sliding_window_pattern", 3),
        )
        // layers 2 and 5 full, the other four windowed
        assertEquals(KvCacheShape(2 * 20L, 4 * 20L, 1024), s.kvCache)
    }

    @Test
    fun `a window without a pattern counts every layer as full`() {
        val s = shape(
            GgufBytes()
                .string("general.architecture", "mistral")
                .u32("mistral.block_count", 2)
                .u32("mistral.attention.head_count", 1)
                .u32("mistral.attention.key_length", 8)
                .u32("mistral.attention.sliding_window", 4096),
        )
        assertEquals(KvCacheShape(32, 0, null), s.kvCache)
    }

    @Test
    fun `a recurrent model has no cache`() {
        val s = shape(GgufBytes().string("general.architecture", "mamba").u32("mamba.block_count", 24))
        assertEquals(KvCacheShape(0, 0, null), s.kvCache)
    }

    @Test
    fun `the first part of a split model has no parameter count`() {
        val s = shape(Models.qwen35().u32("split.count", 3).tensor("w", 10))
        assertNull(s.parameterCount)
    }

    @Test
    fun `not a language model`() {
        assertEquals("no general.architecture", invalid(GgufBytes().u32("x", 1)))
        assertEquals(
            "no clip.block_count: not a language model",
            invalid(GgufBytes().string("general.architecture", "clip").u32("clip.vision.block_count", 27)),
        )
        assertEquals("llama.block_count is 0", invalid(GgufBytes().string("general.architecture", "llama").u32("llama.block_count", 0)))
    }

    @Test
    fun `broken per-layer values are refused`() {
        fun model() = GgufBytes().string("general.architecture", "m").u32("m.block_count", 3)
        assertEquals("m.attention.head_count_kv has 2 values for 3 layers", invalid(model().u32s("m.attention.head_count_kv", listOf(1, 1))))
        assertEquals("m.attention.head_count_kv is not a number", invalid(model().string("m.attention.head_count_kv", "4")))
        assertEquals("m.attention.head_count is 4294967295", invalid(model().u32("m.attention.head_count", 0xffffffffL)))
        assertEquals(
            "m.attention.sliding_window_pattern has 1 values for 3 layers",
            invalid(model().u32("m.attention.sliding_window", 8).bools("m.attention.sliding_window_pattern", listOf(true))),
        )
    }

    private fun invalid(bytes: GgufBytes): String = assertThrows<LmeException.InvalidGguf> { shape(bytes) }.reason
}
