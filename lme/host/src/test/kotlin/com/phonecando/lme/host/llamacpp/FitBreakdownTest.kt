package com.phonecando.lme.host.llamacpp

import com.phonecando.lme.api.serve.MeasuredMemory
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class FitBreakdownTest {
    private val mib = 1L shl 20

    // The pinned server's line for the 0.8B at 32k, 8-bit notes, on a CPU with KleidiAI (common/fit.cpp; keys as nlohmann orders them).
    private val line = """{"data":{"rows":[{"compute":67,"context":223,"kind":"host","model":202,"name":"Host","self":492},""" +
        """{"compute":0,"context":0,"kind":"buffer_type","model":259,"name":"CPU_REPACK","self":259},""" +
        """{"compute":0,"context":0,"kind":"buffer_type","model":290,"name":"CPU_KLEIDIAI","self":290}],"unit":"MiB"},"type":"fit_memory_breakdown"}"""

    @Test
    fun `the breakdown's rows are what the server reads in place, copies, keeps per prompt and computes in`() {
        assertEquals(
            MeasuredMemory("tag", 32_768, true, 202 * mib, 549 * mib, 223 * mib, 67 * mib),
            FitBreakdown.parse(line, "tag", 32_768, true),
        )
        // A build without the copies: the host row alone.
        val plain = """{"type":"fit_memory_breakdown","data":{"unit":"MiB","rows":[{"kind":"host","name":"Host","model":508,"context":223,"compute":67}]}}"""
        assertEquals(MeasuredMemory("tag", 16_384, false, 508 * mib, 0, 223 * mib, 67 * mib), FitBreakdown.parse(plain, "tag", 16_384, false))
    }

    @Test
    fun `any other line is not one`() {
        for (other in listOf(
            "",
            "0.00.029.429 I srv    load_model: loading model 'x.gguf'",
            """{"type":"log","time":1,"level":"INFO","msg":"fit_memory_breakdown"}""",
            """{"type":"fit_memory_breakdown","data":{"unit":"GiB","rows":[{"kind":"host","model":1}]}}""",
            """{"type":"fit_memory_breakdown","data":{"unit":"MiB","rows":[{"kind":"buffer_type","model":1}]}}""",
            """{"type":"fit_memory_breakdown","data":""",
        )) {
            assertNull(FitBreakdown.parse(other, "tag", 1, false), other)
        }
    }

    @Test
    fun `the dry run is the server's flags on a port of its own, without the chats dir, logging JSON lines`() {
        val argv = listOf("/lib/s.so", "--model", "/m.gguf", "--port", "8099", "--ctx-size", "32768", "--cache-ram", "0", "--slot-save-path", "/c")
        assertEquals(
            listOf("/lib/s.so", "--model", "/m.gguf", "--port", "0", "--ctx-size", "32768", "--cache-ram", "0", "--fit", "on", "--log-jsonl"),
            FitBreakdown.dryRun(argv),
        )
    }
}
