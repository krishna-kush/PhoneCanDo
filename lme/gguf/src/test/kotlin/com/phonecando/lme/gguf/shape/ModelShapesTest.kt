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
        // 8 layers x 4 kv heads x (256 + 256); 24 recurrent layers x (3 x (4096 + 2 x 16 x 128) + 128 x 4096)
        assertEquals(KvCacheShape(16384, 0, null, 24 * (3 * 8192L + 128 * 4096), quantizable = true), s.kvCache)
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
        assertEquals(KvCacheShape(3 * 1 * 1024L, 12 * 1 * 512L, 512, quantizable = true), shape(Models.gemma4()).kvCache)
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
        assertEquals(KvCacheShape(2 * 32 * 256L, 0, null, quantizable = true), s.kvCache)
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
                .u32("jamba.attention.key_length", 64)
                .u32("jamba.ssm.conv_kernel", 4)
                .u32("jamba.ssm.inner_size", 8192)
                .u32("jamba.ssm.state_size", 16),
        )
        // Mamba layers 0 and 2: (4 - 1) x 8192 rolling plus 16 x 8192 state each.
        assertEquals(KvCacheShape(2 * 2 * 128L, 0, null, 2 * (3 * 8192L + 16 * 8192), quantizable = true), s.kvCache)
    }

    @Test
    fun `recurrent state by family, the same whatever the context`() {
        fun model(arch: String, layers: Long) = GgufBytes().string("general.architecture", arch).u32("$arch.block_count", layers)
        // RWKV: two token shifts of the embedding, plus embedding x head size, on every layer.
        val rwkv = model("rwkv6", 24).u32("rwkv6.embedding_length", 2048).u32("rwkv6.wkv.head_size", 64)
        assertEquals(24 * (2 * 2048L + 2048 * 64), shape(rwkv).kvCache.recurrentPerSequence)
        assertEquals(24 * (3 * 2048L + 2048 * 64), shape(rwkv.u32("rwkv6.token_shift_count", 3)).kvCache.recurrentPerSequence)
        // LFM2: short convolutions keep embedding x (L - 1), on the layers with no KV heads.
        val lfm2 = model("lfm2", 4)
            .u32("lfm2.embedding_length", 1024)
            .u32("lfm2.attention.head_count", 16)
            .u32s("lfm2.attention.head_count_kv", listOf(0, 0, 8, 0))
            .u32("lfm2.shortconv.l_cache", 3)
        assertEquals(3 * 1024L * 2, shape(lfm2).kvCache.recurrentPerSequence)
        // Kimi Linear's KDA: 3 x (kernel - 1) x heads x D rolling, plus D x D x heads.
        val kimi = model("kimi-linear", 4)
            .u32("kimi-linear.attention.head_count", 32)
            .u32s("kimi-linear.attention.head_count_kv", listOf(0, 0, 0, 8))
            .u32("kimi-linear.kda.head_dim", 128)
            .u32("kimi-linear.ssm.conv_kernel", 4)
        assertEquals(3 * (3 * 3 * 32 * 128L + 128 * 128 * 32), shape(kimi).kvCache.recurrentPerSequence)
        // Mamba2: groups widen the rolling state.
        val mamba2 = model("mamba2", 2)
            .u32("mamba2.ssm.conv_kernel", 4)
            .u32("mamba2.ssm.inner_size", 4096)
            .u32("mamba2.ssm.state_size", 128)
            .u32("mamba2.ssm.group_count", 8)
        assertEquals(2 * (3 * (4096 + 2 * 8 * 128L) + 128 * 4096), shape(mamba2).kvCache.recurrentPerSequence)
        // Attention only: none, whatever its layers say.
        assertEquals(0, shape(Models.gemma4()).kvCache.recurrentPerSequence)
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
        // layers 2 and 5 full, the other four windowed; heads of 10 values cannot be 8-bit
        assertEquals(KvCacheShape(2 * 20L, 4 * 20L, 1024), s.kvCache)
    }

    @Test
    fun `an 8-bit KV cache needs every head in whole 32-value blocks`() {
        fun model(key: Long, value: Long, keySwa: Long? = null) = GgufBytes()
            .string("general.architecture", "m")
            .u32("m.block_count", 2)
            .u32("m.attention.head_count", 4)
            .u32("m.attention.key_length", key)
            .u32("m.attention.value_length", value)
            .apply { if (keySwa != null) u32("m.attention.sliding_window", 512).bools("m.attention.sliding_window_pattern", listOf(true, false)).u32("m.attention.key_length_swa", keySwa) }
        assertEquals(true, shape(model(128, 128)).kvCache.quantizable)
        assertEquals(false, shape(model(128, 80)).kvCache.quantizable)
        assertEquals(true, shape(model(256, 256, keySwa = 128)).kvCache.quantizable)
        assertEquals(false, shape(model(256, 256, keySwa = 72)).kvCache.quantizable)
        // No KV cache at all: nothing to make 8-bit.
        assertEquals(false, shape(GgufBytes().string("general.architecture", "mamba").u32("mamba.block_count", 2)).kvCache.quantizable)
    }

    /** A 6-layer model of [arch] with a window of 1024, heads of 10 + 10 values, and [more] keys. */
    private fun windowedModel(arch: String, more: GgufBytes.() -> GgufBytes = { this }) = shape(
        GgufBytes()
            .string("general.architecture", arch)
            .u32("$arch.block_count", 6)
            .u32("$arch.attention.head_count", 4)
            .u32("$arch.attention.head_count_kv", 1)
            .u32("$arch.attention.key_length", 10)
            .u32("$arch.attention.sliding_window", 1024)
            .more(),
    ).kvCache

    @Test
    fun `a window without a pattern takes llama cpp's own period for the architecture`() {
        // gemma3: one full layer in each 6, the last.
        assertEquals(KvCacheShape(20, 5 * 20L, 1024), windowedModel("gemma3"))
        // gpt-oss: every other layer, the second of each pair full.
        assertEquals(KvCacheShape(3 * 20L, 3 * 20L, 1024), windowedModel("gpt-oss"))
        // cohere2moe: one in 4 full, the first (layers 0 and 4).
        assertEquals(KvCacheShape(2 * 20L, 4 * 20L, 1024), windowedModel("cohere2moe"))
        // phi3: llama.cpp keeps no window for it.
        assertEquals(KvCacheShape(6 * 20L, 0, null), windowedModel("phi3"))
    }

    @Test
    fun `a pattern in the header wins, read as the architecture reads it`() {
        // smallthinker takes the full layer first in each group: layers 0 and 3 of 6.
        assertEquals(KvCacheShape(2 * 20L, 4 * 20L, 1024), windowedModel("smallthinker") { u32("smallthinker.attention.sliding_window_pattern", 3) })
        // A period of 0 windows every layer.
        assertEquals(KvCacheShape(0, 6 * 20L, 1024), windowedModel("gemma3") { u32("gemma3.attention.sliding_window_pattern", 0) })
        assertEquals(
            "m.attention.sliding_window_pattern is 99999",
            invalid(GgufBytes().string("general.architecture", "m").u32("m.block_count", 3).u32("m.attention.sliding_window", 8).u32("m.attention.sliding_window_pattern", 99_999)),
        )
    }

    @Test
    fun `a window with no pattern we know counts every layer both ways, never less than the server keeps`() {
        // An architecture with no rule (exaone4's window depends on its size): full for the KV cache and windowed for checkpoints.
        assertEquals(KvCacheShape(6 * 20L, 6 * 20L, 1024), windowedModel("exaone4"))
        val s = shape(
            GgufBytes()
                .string("general.architecture", "mistral")
                .u32("mistral.block_count", 2)
                .u32("mistral.attention.head_count", 1)
                .u32("mistral.attention.key_length", 8)
                .u32("mistral.attention.sliding_window", 4096),
        )
        assertEquals(KvCacheShape(32, 32, 4096), s.kvCache)
    }

    @Test
    fun `a recurrent model has no KV cache, only its state on every layer`() {
        val s = shape(
            GgufBytes()
                .string("general.architecture", "mamba")
                .u32("mamba.block_count", 24)
                .u32("mamba.ssm.conv_kernel", 4)
                .u32("mamba.ssm.inner_size", 1536)
                .u32("mamba.ssm.state_size", 16),
        )
        // Mamba 130M: (4 - 1) x 1536 rolling plus 16 x 1536 state, on all 24 layers.
        assertEquals(KvCacheShape(0, 0, null, 24 * (3 * 1536L + 16 * 1536)), s.kvCache)
        assertEquals(KvCacheShape.NONE, shape(GgufBytes().string("general.architecture", "mamba").u32("mamba.block_count", 24)).kvCache)
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
        assertEquals("m.ssm.inner_size is 4294967295", invalid(model().u32("m.ssm.inner_size", 0xffffffffL)))
    }

    private fun invalid(bytes: GgufBytes): String = assertThrows<LmeException.InvalidGguf> { shape(bytes) }.reason
}
