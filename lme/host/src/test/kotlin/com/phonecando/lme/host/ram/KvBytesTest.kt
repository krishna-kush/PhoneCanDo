package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.KvCacheShape
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class KvBytesTest {
    @Test
    fun `full layers keep every cell`() {
        // Qwen3.5-4B at 16k, f16 (64 bytes per 32 values): 8 layers x 4 heads x 512 values x 2 bytes x 16384
        assertEquals(512L shl 20, KvBytes.of(KvCacheShape(16_384, 0, null), 16_384, 64))
        // q8_0: 34 bytes per 32 values
        assertEquals(285_212_672, KvBytes.of(KvCacheShape(16_384, 0, null), 16_384, 34))
    }

    @Test
    fun `window layers keep the window and a batch, padded`() {
        val gemma = KvCacheShape(3_072, 6_144, 512)
        // full: 3072 x 16384 x 2; window: 6144 x (512 + 512) x 2
        assertEquals(100_663_296L + 12_582_912, KvBytes.of(gemma, 16_384, 64))
        // a context shorter than window + batch caps the window layers
        assertEquals(2L * (3_072 * 768 + 6_144 * 768), KvBytes.of(gemma, 768, 64))
        // window + batch padded up to 256 cells: 100 + 512 = 612 -> 768
        assertEquals(2L * 6_144 * 768, KvBytes.of(KvCacheShape(0, 6_144, 100), 16_384, 64))
        // the window layers' part alone
        assertEquals(12_582_912, KvBytes.window(gemma, 16_384, 64))
        assertEquals(0, KvBytes.window(KvCacheShape(16_384, 0, null), 16_384, 64))
    }

    @Test
    fun `recurrent state is no KV cache`() {
        assertEquals(512L shl 20, KvBytes.of(KvCacheShape(16_384, 0, null, 13_172_736), 16_384, 64))
    }

    @Test
    fun `no cache, no bytes`() {
        assertEquals(0, KvBytes.of(KvCacheShape.NONE, 16_384, 64))
    }
}
