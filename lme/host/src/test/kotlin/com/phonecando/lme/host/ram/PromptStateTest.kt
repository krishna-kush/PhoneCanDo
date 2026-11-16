package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.KvCacheShape
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class PromptStateTest {
    private fun bytes(kv: KvCacheShape, context: Long, checkpoints: Int = 4) = PromptState.bytes(kv, context, 64, 4, checkpoints)

    private fun checkpoint(kv: KvCacheShape, context: Long) = PromptState.checkpointBytes(kv, context, 64, 4)

    @Test
    fun `a dense model's state is its KV cache, with no checkpoints`() {
        val dense = KvCacheShape(16_384, 0, null)
        assertEquals(0, checkpoint(dense, 32_768))
        assertEquals(KvBytes.of(dense, 32_768, 64), bytes(dense, 32_768))
    }

    @Test
    fun `a hybrid model adds its recurrent state, and a copy of it in each checkpoint`() {
        // Qwen3.5-4B: 13,172,736 f32 values of recurrent state, 50.25 MiB.
        val qwen = KvCacheShape(16_384, 0, null, 13_172_736)
        assertEquals(52_690_944, checkpoint(qwen, 32_768))
        assertEquals(1_073_741_824 + 52_690_944 + 4 * 52_690_944L, bytes(qwen, 32_768))
        assertEquals(1_073_741_824 + 52_690_944 + 8 * 52_690_944L, bytes(qwen, 32_768, checkpoints = 8))
    }

    @Test
    fun `a windowed model's checkpoints copy the window's KV cache`() {
        // Gemma 4 E2B: 6144 values per token over 1024 cells, f16.
        val gemma = KvCacheShape(3_072, 6_144, 512)
        assertEquals(12_582_912, checkpoint(gemma, 32_768))
        assertEquals(KvBytes.of(gemma, 32_768, 64) + 4 * 12_582_912L, bytes(gemma, 32_768))
        // A context shorter than the window and a batch caps it there too.
        assertEquals(2L * 6_144 * 768, checkpoint(gemma, 768))
    }
}
