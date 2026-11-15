package com.phonecando.lme.host.context

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ContextSizingTest {
    // 1 byte of files, 10 bytes of KV cache per token: a context fits when 1 + 10 x context <= spare.
    private val kv = { context: Long -> 10 * context }

    private fun fitting(spare: Long, trained: Long?) = ContextSizing.fitting(spare, 1, ContextRange.of(trained), kv)

    private fun automatic(budget: Long, spare: Long, trained: Long?) = ContextSizing.automatic(budget, spare, 1, ContextRange.of(trained), kv)

    @Test
    fun `a range runs from the floor, or less, to the trained context`() {
        assertEquals(ContextRange(16_384, 262_144), ContextRange.of(262_144))
        assertEquals(ContextRange(8_192, 8_192), ContextRange.of(8_192))
        assertEquals(ContextRange(16_384, 16_384), ContextRange.of(16_384))
        // Unknown: the floor only.
        assertEquals(ContextRange(16_384, 16_384), ContextRange.of(null))
        val range = ContextRange.of(131_072)
        assertTrue(65_536 in range)
        assertFalse(8_192 in range || 131_073 in range)
        assertEquals(listOf(16_384L, 50_000, 131_072), listOf(1L, 50_000, 1_000_000).map(range::coerce))
        assertThrows<IllegalArgumentException> { ContextRange(0, 10) }
        assertThrows<IllegalArgumentException> { ContextRange(10, 9) }
    }

    @Test
    fun `the whole trained context when it fits`() {
        assertEquals(262_144, fitting(1 + 10 * 262_144, 262_144))
        // A trained context off the 1024 grid is served whole.
        assertEquals(40_000, fitting(1 + 10 * 40_000, 40_000))
        assertEquals(8_192, fitting(1 + 10 * 8_192, 8_192))
    }

    @Test
    fun `else the largest whole step that fits`() {
        assertEquals(262_143 / 1_024 * 1_024, fitting(10 * 262_144, 262_144))
        assertEquals(49_152, fitting(1 + 10 * 49_152, 262_144))
        assertEquals(49_152, fitting(1 + 10 * 50_175, 262_144))
        assertEquals(39_936, fitting(1 + 10 * 39_999, 40_000))
        assertEquals(17_408, fitting(1 + 10 * 17_408, 262_144))
    }

    @Test
    fun `never below the floor, whatever is spare`() {
        assertEquals(16_384, fitting(1 + 10 * 17_407, 262_144))
        assertEquals(16_384, fitting(0, 262_144))
        assertEquals(16_384, fitting(0, null))
        assertEquals(8_192, fitting(0, 8_192))
    }

    @Test
    fun `automatic is up to 64k of what is spare, and at least 32k of what the budget holds`() {
        val plenty = Long.MAX_VALUE / 2
        assertEquals(65_536, automatic(plenty, plenty, 262_144))
        // Under the cap a trained context is served whole, on the grid or not.
        assertEquals(40_000, automatic(plenty, plenty, 40_000))
        assertEquals(24_576, automatic(plenty, 0, 24_576))
        // What is spare decides from 32k up.
        assertEquals(39_936, automatic(plenty, 1 + 10 * 40_000, 262_144))
        assertEquals(32_768, automatic(plenty, 1 + 10 * 20_000, 262_144))
        assertEquals(32_768, automatic(plenty, 0, 262_144))
        // Below 32k, what the budget holds; never below the floor.
        assertEquals(20_480, automatic(1 + 10 * 20_480, 0, 262_144))
        assertEquals(16_384, automatic(0, 0, 262_144))
        assertEquals(16_384, automatic(plenty, plenty, null))
        assertEquals(8_192, automatic(0, 0, 8_192))
    }

    @Test
    fun `the search agrees with counting up`() {
        val trained = 131_072L
        for (spare in listOf(0L, 170_000, 400_000, 655_361, 999_999, 1_310_720, 1_310_721)) {
            val range = ContextRange.of(trained)
            val counted = if (1 + kv(trained) <= spare) {
                trained
            } else {
                (range.min..trained step ContextSizing.STEP).lastOrNull { 1 + kv(it) <= spare } ?: range.min
            }
            assertEquals(counted, fitting(spare, trained), "spare $spare")
        }
    }
}
