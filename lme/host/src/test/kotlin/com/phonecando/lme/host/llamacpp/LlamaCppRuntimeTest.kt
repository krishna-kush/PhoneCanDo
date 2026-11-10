package com.phonecando.lme.host.llamacpp

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.lme.api.serve.WireApi
import com.phonecando.lme.host.LaunchRequest
import com.phonecando.lme.host.context.ContextSizing
import com.phonecando.lme.host.key.ApiKeys
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamVerdict
import com.phonecando.lme.host.support.Phones
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class LlamaCppRuntimeTest {
    private val key = ApiKeys.newKey()
    private val lib = "/data/app/x/lib/arm64/libllama-server.so"
    private val gib = 1L shl 30

    private fun request(model: ModelRecord = Phones.QWEN_4B, device: DeviceInfo = Phones.MOTO_G96_IDLE) =
        LaunchRequest(model, "/data/user/0/app/files/models/${model.id}/${model.entry.name}", lib, device, 8099, key)

    private fun auto(m: ModelRecord, device: DeviceInfo) = LlamaCppRuntime.contextPlan(device, m)

    @Test
    fun `the spike's server on our test phone, with the context the 4B fits and its prompt cache cap`() {
        val plan = LlamaCppRuntime.plan(request())
        assertEquals(
            listOf(
                lib,
                "--model", "/data/user/0/app/files/models/qwen3-5-4b-q4-k-m/qwen3-5-4b-q4-k-m.gguf",
                "--alias", "qwen3-5-4b-q4-k-m",
                "--host", "127.0.0.1",
                "--port", "8099",
                "--ctx-size", "33792",
                "--parallel", "1",
                "--threads", "4",
                "--jinja",
                "--reasoning", "off",
                "--no-ui",
                "--cache-ram", "22",
            ),
            plan.argv,
        )
        assertEquals(mapOf("LLAMA_API_KEY" to key), plan.env)
        assertEquals("http://127.0.0.1:8099/health", plan.healthUrl)
        assertEquals(
            ServedEndpoint("http://127.0.0.1:8099", "qwen3-5-4b-q4-k-m", key, 33_792, setOf(WireApi.OPENAI_CHAT, WireApi.OPENAI_RESPONSES, WireApi.ANTHROPIC)),
            plan.endpoint,
        )
        // Files plus 33k of KV cache (8 layers x 4 heads x 512 values x 2 bytes x 33792) against half of 7.2 GiB.
        assertEquals(RamVerdict.Fits(2_740_937_888 + 1_107_296_256, 3_872_016_350), plan.ram)
        assertEquals(22, plan.promptCacheMiB)
        assertEquals(4, plan.threads)
    }

    @Test
    fun `the key never shows in the argv or a string`() {
        val plan = LlamaCppRuntime.plan(request())
        assertFalse(plan.argv.any { key in it })
        assertFalse(key in plan.toString())
        assertFalse(key in request().toString())
    }

    @Test
    fun `the whole trained context when it fits, else the most that fits in steps of 1024`() {
        val idle = Phones.MOTO_G96_IDLE
        // Qwen3.5 0.8B: 256k of KV cache is 3 GiB, and with its files that still fits the 3.87 GB budget.
        val small = auto(Phones.QWEN_08B, idle)
        assertEquals(262_144, small.context)
        assertFalse(small.reduced)
        assertEquals(3_753_742_592, small.needBytes)
        assertEquals(112, small.promptCacheMiB)
        // Gemma 4 E2B (128k trained) and Qwen3.5 4B (256k): the most whole steps that fit.
        assertEquals(121_856, auto(Phones.GEMMA_E2B, idle).context)
        val four = auto(Phones.QWEN_4B, idle)
        assertEquals(33_792, four.context)
        assertTrue(four.reduced)
        assertEquals(0, four.context % ContextSizing.STEP)
        assertTrue(four.needBytes <= RamGate.budget(idle.totalRamBytes))
        // Qwen3.5 9B: not even the floor fits, and the floor is what the gate refuses.
        val nine = auto(Phones.QWEN_9B, idle)
        assertEquals(16_384, nine.context)
        assertEquals(RamVerdict.Refused(6_217_393_376, 3_872_016_350), nine.ram)
        assertEquals(0, nine.promptCacheMiB)
    }

    @Test
    fun `bigger phones get more, up to the trained context`() {
        fun contexts(device: DeviceInfo) = listOf(Phones.QWEN_08B, Phones.GEMMA_E2B, Phones.QWEN_4B, Phones.QWEN_9B).map { auto(it, device).context }
        assertEquals(listOf(262_144L, 121_856, 33_792, 16_384), contexts(Phones.MOTO_G96_IDLE))
        assertEquals(listOf(262_144L, 131_072, 99_328, 16_384), contexts(Phones.withRam(11.2)))
        assertEquals(listOf(262_144L, 131_072, 161_792, 71_680), contexts(Phones.withRam(15.0)))
        assertIs<RamVerdict.Refused>(auto(Phones.QWEN_9B, Phones.withRam(11.2)).ram)
        assertIs<RamVerdict.Fits>(auto(Phones.QWEN_9B, Phones.withRam(15.0)).ram)
    }

    @Test
    fun `what is free now bounds the automatic context, never below the floor`() {
        // The Moto g96 as we read it with apps open: 2.7 GiB free, less our 512 MiB margin.
        val busy = Phones.MOTO_G96
        assertEquals(2_356_551_680, RamGate.spare(busy.totalRamBytes, busy.availableRamBytes))
        val small = auto(Phones.QWEN_08B, busy)
        assertEquals(147_456, small.context)
        assertEquals(11, small.promptCacheMiB)
        // The 4B does not fit what is free even at the floor: it keeps the floor, and the budget's verdict.
        val four = auto(Phones.QWEN_4B, busy)
        assertEquals(16_384, four.context)
        assertEquals(RamVerdict.Fits(3_277_808_800, 3_872_016_350), four.ram)
        assertEquals(0, four.promptCacheMiB)
        val plan = LlamaCppRuntime.plan(request(Phones.QWEN_4B, busy))
        assertEquals(16_384, plan.endpoint.contextWindow)
        assertEquals(listOf("--cache-ram", "0"), plan.argv.takeLast(2))
        // Nothing free at all: still the floor.
        assertEquals(16_384, auto(Phones.QWEN_08B, busy.copy(availableRamBytes = 0)).context)
    }

    @Test
    fun `a model trained for less context gets its own, and one of unknown context the floor`() {
        val old = Phones.model("old", 1_000_000_000, Phones.QWEN_4B.shape.kvCache, 8_192)
        assertEquals(8_192, LlamaCppRuntime.plan(request(old)).contextSize)
        val mid = Phones.model("mid", 1_000_000_000, Phones.QWEN_4B.shape.kvCache, 24_576)
        assertEquals(24_576, LlamaCppRuntime.plan(request(mid)).contextSize)
        val odd = Phones.model("odd", 1_000_000_000, Phones.QWEN_4B.shape.kvCache, 40_000)
        assertEquals(40_000, LlamaCppRuntime.plan(request(odd)).contextSize)
        val unknown = Phones.model("unknown", 1_000_000_000, Phones.QWEN_4B.shape.kvCache, null)
        val plan = auto(unknown, Phones.MOTO_G96_IDLE)
        assertEquals(16_384, plan.context)
        assertFalse(plan.reduced)
    }

    @Test
    fun `the automatic context never changes a verdict, and the prompt cache stays in the budget`() {
        for (gib in listOf(3.6, 5.5, 6.5, 7.21, 11.2, 11.6, 15.0)) {
            for (free in listOf(0.5, 2.7, 5.0, gib)) {
                val device = Phones.withRam(gib, free)
                val total = device.totalRamBytes
                val spare = RamGate.spare(total, device.availableRamBytes)
                for (m in listOf(Phones.QWEN_08B, Phones.QWEN_4B, Phones.GEMMA_E2B, Phones.QWEN_9B)) {
                    val what = "${m.id} on $gib GiB, $free free"
                    val floor = LlamaCppRuntime.memoryNeed(m.sizeBytes, m.shape.kvCache, ContextSizing.FLOOR)
                    val plan = auto(m, device)
                    assertEquals(RamGate.check(total, floor)::class, plan.ram::class, what)
                    assertTrue(plan.context in ContextSizing.FLOOR..m.shape.contextLength!!, what)
                    if (plan.context > ContextSizing.FLOOR) assertTrue(plan.needBytes <= spare, what)
                    if (plan.ram is RamVerdict.Fits || plan.ram is RamVerdict.Tight) {
                        assertTrue(plan.needBytes + plan.promptCacheMiB * (1L shl 20) <= RamGate.budget(total), what)
                    }
                }
            }
        }
    }

    @Test
    fun `a chosen context is served as chosen, past the budget too, but not past the phone's RAM`() {
        val moto = Phones.MOTO_G96_IDLE
        val four = Phones.QWEN_4B.copy(context = 65_536)
        val plan = LlamaCppRuntime.plan(request(four))
        assertEquals(65_536, plan.contextSize)
        assertEquals(65_536, plan.endpoint.contextWindow)
        assertEquals(RamVerdict.OverBudget(4_888_421_536, 3_872_016_350), plan.ram)
        assertEquals(listOf("--cache-ram", "0"), plan.argv.takeLast(2))
        val chosen = auto(four, moto)
        assertFalse(chosen.automatic)
        assertFalse(chosen.reduced)

        // Less than automatic leaves the prompt cache more room.
        val less = auto(Phones.QWEN_4B.copy(context = 16_384), moto)
        assertEquals(RamVerdict.Fits(3_277_808_800, 3_872_016_350), less.ram)
        assertEquals((3_872_016_350 - 3_277_808_800) / (1L shl 20), less.promptCacheMiB)

        // The 9B at the floor: refused when automatic, over the budget but allowed when chosen.
        val nine = LlamaCppRuntime.plan(request(Phones.QWEN_9B.copy(context = 16_384)))
        assertEquals(RamVerdict.OverBudget(6_217_393_376, 3_872_016_350), nine.ram)
        val whole = assertThrows<LmeException.NotEnoughMemory> { LlamaCppRuntime.plan(request(Phones.QWEN_9B.copy(context = 262_144))) }
        assertEquals(14_270_457_056, whole.needed)

        // A choice out of the model's range is brought into it.
        assertEquals(16_384, auto(Phones.QWEN_4B.copy(context = 1_000), moto).context)
        assertEquals(262_144, auto(Phones.QWEN_08B.copy(context = 1_000_000), moto).context)
    }

    @Test
    fun `too big, too small a phone, or the wrong CPU is refused`() {
        val e = assertThrows<LmeException.NotEnoughMemory> { LlamaCppRuntime.plan(request(Phones.QWEN_9B)) }
        assertEquals(6_217_393_376, e.needed)
        assertThrows<LmeException.UnsupportedDevice> { LlamaCppRuntime.plan(request(Phones.QWEN_08B, Phones.withRam(3.5))) }
        assertIs<RamVerdict.Tight>(LlamaCppRuntime.plan(request(Phones.QWEN_08B, Phones.withRam(5.5))).ram)

        val arm32 = Phones.MOTO_G96.copy(abi = "armeabi-v7a")
        assertEquals("needs a 64-bit ARM phone (arm64-v8a), this one is armeabi-v7a", assertThrows<LmeException.UnsupportedDevice> { LlamaCppRuntime.plan(request(device = arm32)) }.reason)
        val a53 = Phones.MOTO_G96.copy(cpuFeatures = setOf("fp", "asimd"))
        assertEquals("the CPU lacks asimddp, asimdhp", assertThrows<LmeException.UnsupportedDevice> { LlamaCppRuntime.plan(request(device = a53)) }.reason)
    }

    @Test
    fun `the plan serves the context plan`() {
        for (device in listOf(Phones.MOTO_G96, Phones.MOTO_G96_IDLE, Phones.withRam(15.0))) {
            val gemma = Phones.GEMMA_E2B
            val plan = LlamaCppRuntime.plan(request(gemma, device))
            val sizing = auto(gemma, device)
            assertEquals(sizing.context, plan.contextSize)
            assertEquals(sizing.promptCacheMiB, plan.promptCacheMiB)
            assertEquals(sizing.ram, plan.ram)
            assertEquals(LlamaCppRuntime.memoryNeed(gemma.sizeBytes, gemma.shape.kvCache, sizing.context), (plan.ram as RamVerdict.Fits).needBytes)
        }
        assertEquals(16_384, LlamaCppRuntime.baseContext(null))
        assertEquals(4_096, LlamaCppRuntime.baseContext(4_096))
        assertEquals(16_384, LlamaCppRuntime.baseContext(262_144))
    }

    @Test
    fun `bad requests are bugs`() {
        assertThrows<IllegalArgumentException> { LlamaCppRuntime.plan(request().copy(port = 0)) }
        assertThrows<IllegalArgumentException> { LlamaCppRuntime.plan(request().copy(apiKey = "a,b")) }
        assertThrows<IllegalArgumentException> { LlamaCppRuntime.plan(request().copy(modelPath = "models/x.gguf")) }
        assertThrows<IllegalArgumentException> { LlamaCppRuntime.serve("/s", "/m.gguf", "m", 16_384, null, 8099, 0, key) }
        assertThrows<IllegalArgumentException> { LlamaCppRuntime.serve("/s", "/m.gguf", "m", 0, null, 8099, 4, key) }
        assertThrows<IllegalArgumentException> { LlamaCppRuntime.serve("/s", "/m.gguf", "m", 16_384, -1, 8099, 4, key) }
    }

    @Test
    fun `the plan runs the server command, which needs no phone`() {
        val plan = LlamaCppRuntime.plan(request())
        val model = Phones.QWEN_4B
        val server = LlamaCppRuntime.serve(lib, plan.argv[2], model.id, plan.contextSize, plan.promptCacheMiB, 8099, 4, key)
        assertEquals(plan.argv, server.argv)
        assertEquals(plan.env, server.env)
        assertEquals(plan.healthUrl, server.healthUrl)
        assertEquals(plan.endpoint, server.endpoint)
        assertFalse(key in server.toString())
        // An x86 CI host, no device: the same flags, its own thread count, the server's own prompt cache.
        val host = LlamaCppRuntime.serve("/opt/llama-server", "/m/q.gguf", "q", 4_096, null, 18080, 8, key)
        assertEquals(listOf("--ctx-size", "4096"), host.argv.subList(9, 11))
        assertEquals(listOf("--threads", "8"), host.argv.subList(13, 15))
        assertEquals("--no-ui", host.argv.last())
        assertFalse("--cache-ram" in host.argv)
        assertEquals(4_096, host.contextSize)
    }

    @Test
    fun `memory need is files plus the KV cache`() {
        val q = Phones.QWEN_4B
        assertEquals(2_740_937_888 + 536_870_912, LlamaCppRuntime.memoryNeed(q.sizeBytes, q.shape.kvCache, 16_384))
        assertEquals(6 * gib, LlamaCppRuntime.memoryNeed(6 * gib, KvCacheShape.NONE, 262_144))
    }
}
