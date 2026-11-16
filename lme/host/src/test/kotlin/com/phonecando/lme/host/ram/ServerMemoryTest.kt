package com.phonecando.lme.host.ram

import com.phonecando.lme.api.serve.MeasuredMemory
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ServerMemoryTest {
    private val mib = 1L shl 20

    /** Qwen3.5 0.8B Q4_K_M at 32k with 8-bit notes on our test phone (its `fit_memory_breakdown`). */
    private val phone = MeasuredMemory("cpu=asimddp;server=1", 32_768, true, 202 * mib, 549 * mib, 223 * mib, 67 * mib)

    @Test
    fun `a measurement is the server's own count, its compute buffer growing in step past the context measured`() {
        val m = ServerMemory.measured(phone)
        assertTrue(m.measured)
        assertEquals(202 * mib, m.mappedBytes)
        assertEquals(549 * mib, m.copiedBytes)
        assertEquals(751 * mib, m.weightsBytes)
        assertEquals(67 * mib, m.computeBytes(32_768))
        assertEquals(67 * mib, m.computeBytes(16_384))
        // At 160k it measured 195 MiB; growing in step from 32k counts more, never less.
        assertEquals(335 * mib, m.computeBytes(163_840))
        assertTrue(m.computeBytes(163_840) >= 195 * mib)
        assertEquals(ServerMemory.of(1, phone).weightsBytes, m.weightsBytes)
    }

    @Test
    fun `before a measurement every weight counts twice, with a compute buffer above what the phone measured`() {
        val size = 532_517_120L
        val e = ServerMemory.estimated(size)
        assertFalse(e.measured)
        assertEquals(size, e.mappedBytes)
        assertEquals(size, e.copiedBytes)
        // 64 MiB (more than an eighth of 508 MiB) plus 2 KiB a token: 128 MiB at 32k.
        assertEquals(128 * mib, e.computeBytes(32_768))
        // Safe on what the 0.8B measured: its weights, and the compute buffer at 32k and at 160k.
        assertTrue(e.weightsBytes >= phone.mappedBytes + phone.copiedBytes)
        assertTrue(e.computeBytes(32_768) >= 67 * mib && e.computeBytes(163_840) >= 195 * mib)
        // A big model's compute buffer starts at an eighth of its files.
        assertEquals(5_680_522_464 / 8 + 32_768 * 2_048, ServerMemory.estimated(5_680_522_464).computeBytes(32_768))
        assertEquals(ServerMemory.of(size, null).weightsBytes, e.weightsBytes)
    }

    @Test
    fun `the files alone count no copies and no compute buffer`() {
        val f = ServerMemory.filesOnly(1_000)
        assertEquals(1_000, f.weightsBytes)
        assertEquals(0, f.copiedBytes)
        assertEquals(0, f.computeBytes(262_144))
        assertFalse(f.measured)
    }
}
