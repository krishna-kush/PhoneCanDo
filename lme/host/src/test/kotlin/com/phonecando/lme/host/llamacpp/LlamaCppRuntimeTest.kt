package com.phonecando.lme.host.llamacpp

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheChoice
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.RamShare
import com.phonecando.lme.api.model.ServeChoices
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.lme.api.serve.WireApi
import com.phonecando.lme.host.LaunchRequest
import com.phonecando.lme.host.context.ContextPlan
import com.phonecando.lme.host.context.ContextSizing
import com.phonecando.lme.host.key.ApiKeys
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamRules
import com.phonecando.lme.host.ram.RamVerdict
import com.phonecando.lme.host.ram.ServerMemory
import com.phonecando.lme.host.support.Phones
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LlamaCppRuntimeTest {
    private val key = ApiKeys.newKey()
    private val lib = "/data/app/x/lib/arm64/libllama-server.so"
    private val gib = 1L shl 30
    private val mib = 1L shl 20

    /**
     * A measurement of [m] that counts its files alone, no copies and no
     * compute buffer: the sizing these tests pin (ServerMemoryTest and the
     * tests at the end count the rest).
     */
    private fun files(m: ModelRecord) = MeasuredMemory("test", 1, false, m.sizeBytes, 0, 0, 0)

    private fun request(model: ModelRecord = Phones.QWEN_4B, device: DeviceInfo = Phones.MOTO_G96_IDLE) =
        LaunchRequest(model, "/data/user/0/app/files/models/${model.id}/${model.entry.name}", lib, device, 8099, key, files(model))

    private fun auto(m: ModelRecord, device: DeviceInfo) = LlamaCppRuntime.contextPlan(device, m, files(m))

    private fun ModelRecord.with(serve: ServeChoices) = copy(serve = serve)

    /** The values after [flag] in [argv]. */
    private fun List<String>.after(flag: String, count: Int = 1) = indexOf(flag).let { if (it < 0) emptyList() else subList(it + 1, it + 1 + count) }

    @Test
    fun `the spike's server on our test phone, the 4B at 32k with an 8-bit KV cache, the rest of what is spare to its prompt cache`() {
        val plan = LlamaCppRuntime.plan(request())
        assertEquals(
            listOf(
                lib,
                "--model", "/data/user/0/app/files/models/qwen3-5-4b-q4-k-m/qwen3-5-4b-q4-k-m.gguf",
                "--alias", "qwen3-5-4b-q4-k-m",
                "--host", "127.0.0.1",
                "--port", "8099",
                "--ctx-size", "32768",
                "--parallel", "1",
                "--slot-prompt-similarity", "0",
                "--threads", "4",
                "--jinja",
                "--reasoning", "off",
                "--no-ui",
                "--cache-type-k", "q8_0",
                "--cache-type-v", "q8_0",
                "--ctx-checkpoints", "4",
                "--cache-ram", "17",
            ),
            plan.argv,
        )
        assertEquals(mapOf("LLAMA_API_KEY" to key), plan.env)
        assertEquals("http://127.0.0.1:8099/health", plan.healthUrl)
        assertEquals(
            ServedEndpoint("http://127.0.0.1:8099", "qwen3-5-4b-q4-k-m", key, 32_768, setOf(WireApi.OPENAI_CHAT, WireApi.OPENAI_RESPONSES, WireApi.ANTHROPIC)),
            plan.endpoint,
        )
        // Files, 32k of 8-bit KV cache (8 layers x 4 heads x 512 values x 34/32 bytes x 32768), the recurrent state
        // and 4 checkpoints (50.25 MiB each) against half of 7.2 GiB. With f16 the budget holds only 25k.
        val need = 2_740_937_888 + 570_425_344 + 5 * 52_690_944
        assertEquals(RamVerdict.Fits(need, 3_872_016_350), plan.ram)
        assertEquals(17, plan.promptCacheMiB)
        assertEquals(need + 17 * mib, plan.totalBytes)
        // What it takes from free memory: all but its files, which are mapped from storage.
        assertEquals(need + 17 * mib - 2_740_937_888, plan.heldBytes)
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
    fun `automatic is the most that fits what is spare with room for two saved prompts, up to 64k, and at least 32k when the budget holds it`() {
        val idle = Phones.MOTO_G96_IDLE
        // 5 GiB free, less what we keep free (16% of 7.2 GiB and 512 MiB), within the 3.87 GB budget.
        assertEquals(3_592_792_976, RamGate.spare(idle.totalRamBytes, idle.availableRamBytes))
        // Qwen3.5 0.8B (256k trained): 64k, the most we start with, and room for two more prompts like it.
        val small = auto(Phones.QWEN_08B, idle)
        assertEquals(65_536, small.context)
        assertTrue(small.reduced)
        assertFalse(small.halfKvCache)
        assertEquals(1_438_830_848, small.needBytes)
        assertEquals(1_729, small.promptCacheMiB)
        assertEquals(2, small.savedPrompts)
        assertEquals(3_251_818_752, small.totalBytes)
        assertFalse(small.freeMemoryLimits)
        // Gemma 4 E2B (128k trained): past 32k there is no room for two more, so 32k, the rest to its prompt cache.
        val gemma = auto(Phones.GEMMA_E2B, idle)
        assertEquals(32_768, gemma.context)
        assertEquals(211, gemma.promptCacheMiB)
        // That holds one saved chat (a state at half the context), and with its whole share free it would hold more.
        assertEquals(1, gemma.savedPrompts)
        assertTrue(gemma.freeMemoryLimits)
        // Qwen3.5 4B: with f16 the budget holds 25k, short of the 32k an agent needs; 8-bit, it holds 32k.
        val four = auto(Phones.QWEN_4B, idle)
        assertEquals(32_768, four.context)
        assertTrue(four.halfKvCache)
        assertTrue(four.needBytes <= RamGate.budget(idle.totalRamBytes))
        // Its share, not free memory, is what leaves no room for a saved chat.
        assertEquals(0, four.savedPrompts)
        assertFalse(four.freeMemoryLimits)
        // Qwen3.5 9B: not even the floor fits, 8-bit too, and the floor is what the gate refuses.
        val nine = auto(Phones.QWEN_9B, idle)
        assertEquals(16_384, nine.context)
        assertEquals(RamVerdict.Refused(6_229_189_856, 3_872_016_350), nine.ram)
        assertEquals(0, nine.promptCacheMiB)
    }

    @Test
    fun `bigger phones get more, up to 64k, and full-size KV caches once they hold 32k`() {
        val models = listOf(Phones.QWEN_08B, Phones.GEMMA_E2B, Phones.QWEN_4B, Phones.QWEN_9B)
        fun contexts(device: DeviceInfo) = models.map { auto(it, device).context }
        fun half(device: DeviceInfo) = models.map { auto(it, device).halfKvCache }
        assertEquals(listOf(65_536L, 32_768, 32_768, 16_384), contexts(Phones.MOTO_G96_IDLE))
        assertEquals(listOf(false, false, true, true), half(Phones.MOTO_G96_IDLE))
        assertEquals(listOf(65_536L, 65_536, 32_768, 16_384), contexts(Phones.withRam(11.2)))
        assertEquals(listOf(false, false, false, true), half(Phones.withRam(11.2)))
        assertEquals(listOf(65_536L, 65_536, 45_056, 32_768), contexts(Phones.withRam(15.0)))
        assertEquals(listOf(false, false, false, false), half(Phones.withRam(15.0)))
        assertIs<RamVerdict.Refused>(auto(Phones.QWEN_9B, Phones.withRam(11.2)).ram)
        assertIs<RamVerdict.Fits>(auto(Phones.QWEN_9B, Phones.withRam(15.0)).ram)
    }

    @Test
    fun `what is free now bounds the automatic context, never below 32k when the budget holds it`() {
        // The Moto g96 as we read it with apps open: 2.7 GiB free, less the 1.65 GiB we keep free.
        val busy = Phones.MOTO_G96
        assertEquals(1_117_506_448, RamGate.spare(busy.totalRamBytes, busy.availableRamBytes))
        // The 0.8B past 32k would leave no room for its saved prompts: 32k. Full-size notes would leave 77 MiB, no
        // saved chat; half size leaves room for one.
        val small = auto(Phones.QWEN_08B, busy)
        assertEquals(32_768, small.context)
        assertTrue(small.halfKvCache)
        assertEquals(257, small.promptCacheMiB)
        assertEquals(1, small.savedPrompts)
        assertTrue(small.freeMemoryLimits)
        assertTrue(small.totalBytes <= RamGate.spare(busy.totalRamBytes, busy.availableRamBytes))
        // With 3.5 GiB free: room for two saved chats, not two whole prompts, so still 32k, full size.
        val roomy = auto(Phones.QWEN_08B, busy.copy(availableRamBytes = 3L * gib + gib / 2))
        assertEquals(32_768, roomy.context)
        assertFalse(roomy.halfKvCache)
        assertEquals(902, roomy.promptCacheMiB)
        assertEquals(2, roomy.savedPrompts)
        // The 4B gets the 32k the budget holds with an 8-bit cache, and no prompt cache.
        val four = auto(Phones.QWEN_4B, busy)
        assertEquals(32_768, four.context)
        assertEquals(RamVerdict.Fits(3_574_817_952, 3_872_016_350), four.ram)
        assertEquals(0, four.promptCacheMiB)
        val plan = LlamaCppRuntime.plan(request(Phones.QWEN_4B, busy))
        assertEquals(32_768, plan.endpoint.contextWindow)
        assertEquals(listOf("--cache-ram", "0"), plan.argv.takeLast(2))
        // Nothing free at all: still 32k.
        assertEquals(32_768, auto(Phones.QWEN_08B, busy.copy(availableRamBytes = 0)).context)
    }

    @Test
    fun `a model trained for less context gets its own, and one of unknown context the floor`() {
        val old = Phones.model("old", 1_000_000_000, Phones.QWEN_4B.shape.kvCache, 8_192)
        assertEquals(8_192, LlamaCppRuntime.plan(request(old)).contextSize)
        val mid = Phones.model("mid", 1_000_000_000, Phones.QWEN_4B.shape.kvCache, 24_576)
        assertEquals(24_576, LlamaCppRuntime.plan(request(mid)).contextSize)
        val odd = Phones.model("odd", 1_000_000_000, Phones.QWEN_4B.shape.kvCache, 40_000)
        assertEquals(40_000, LlamaCppRuntime.plan(request(odd, Phones.withRam(15.0))).contextSize)
        val unknown = Phones.model("unknown", 1_000_000_000, Phones.QWEN_4B.shape.kvCache, null)
        val plan = auto(unknown, Phones.MOTO_G96_IDLE)
        assertEquals(16_384, plan.context)
        assertFalse(plan.reduced)
    }

    @Test
    fun `the automatic context never changes a verdict, and the prompt cache stays in what is spare`() {
        for (gib in listOf(3.6, 5.5, 6.5, 7.0, 7.21, 11.2, 11.6, 15.0)) {
            for (free in listOf(0.5, 2.7, 5.0, gib)) {
                val device = Phones.withRam(gib, free)
                val total = device.totalRamBytes
                val budget = RamGate.budget(total)
                val spare = RamGate.spare(total, device.availableRamBytes)
                for (m in listOf(Phones.QWEN_08B, Phones.QWEN_4B, Phones.GEMMA_E2B, Phones.QWEN_9B)) {
                    val what = "${m.id} on $gib GiB, $free free"
                    val plan = auto(m, device)
                    fun need(context: Long) =
                        LlamaCppRuntime.memoryNeed(m.sizeBytes, m.shape.kvCache, context, plan.halfKvCache, memory = ServerMemory.filesOnly(m.sizeBytes))
                    assertEquals(RamGate.check(total, need(ContextSizing.FLOOR))::class, plan.ram::class, what)
                    assertTrue(plan.context in ContextSizing.FLOOR..ContextSizing.AUTO_MOST, what)
                    // Past 32k only as far as what is spare goes, with room for the saved prompts; 32k whenever the budget holds it.
                    if (plan.context > ContextSizing.AUTO_LEAST) {
                        assertTrue(plan.needBytes + RamRules.CACHED_PROMPTS * plan.promptBytes <= spare, what)
                        assertEquals(RamRules.CACHED_PROMPTS, plan.savedPrompts, what)
                    }
                    if (need(ContextSizing.AUTO_LEAST) <= budget) assertTrue(plan.context >= ContextSizing.AUTO_LEAST, what)
                    // The prompt cache: room for the saved prompts at most, and only out of what is spare.
                    assertTrue(plan.promptCacheMiB * mib < RamRules.CACHED_PROMPTS * plan.promptBytes + mib, what)
                    if (plan.promptCacheMiB > 0) assertTrue(plan.totalBytes <= spare, what)
                    if (plan.ram is RamVerdict.Fits || plan.ram is RamVerdict.Tight) assertTrue(plan.totalBytes <= budget, what)
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
        assertEquals(RamVerdict.OverBudget(4_145_243_296, 3_872_016_350), plan.ram)
        assertEquals(listOf("--cache-ram", "0"), plan.argv.takeLast(2))
        val chosen = auto(four, moto)
        assertFalse(chosen.automatic)
        assertFalse(chosen.reduced)

        // Less than automatic leaves the prompt cache more room, from what is spare.
        val less = auto(Phones.QWEN_4B.copy(context = 16_384), moto)
        assertEquals(RamVerdict.Fits(3_289_605_280, 3_872_016_350), less.ram)
        assertEquals((3_592_792_976 - 3_289_605_280) / mib, less.promptCacheMiB)
        // Room for two prompts, rounded up to a whole MiB: 16k of the 0.8B's KV cache (192 MiB), its recurrent
        // state and checkpoints (96.3 MiB), twice.
        val small = auto(Phones.QWEN_08B.copy(context = 16_384), moto)
        assertEquals(577, small.promptCacheMiB)
        assertEquals(2, small.savedPrompts)

        // The 9B at the floor: refused when automatic, over the budget but allowed when chosen.
        val nine = LlamaCppRuntime.plan(request(Phones.QWEN_9B.copy(context = 16_384)))
        assertEquals(RamVerdict.OverBudget(6_229_189_856, 3_872_016_350), nine.ram)
        val whole = assertThrows<LmeException.NotEnoughMemory> { LlamaCppRuntime.plan(request(Phones.QWEN_9B.copy(context = 262_144))) }
        assertEquals(10_507_379_936, whole.needed)

        // A choice out of the model's range is brought into it.
        assertEquals(16_384, auto(Phones.QWEN_4B.copy(context = 1_000), moto).context)
        assertEquals(262_144, auto(Phones.QWEN_08B.copy(context = 1_000_000), moto).context)
    }

    @Test
    fun `on the test phone with several agents running, the small Qwen goes half size to save a chat`() {
        // Free memory that gave the 0.8B at 32k, full size, a prompt cache of 88 MiB: no room for the 14.4k-token
        // Claude Code chat it then held (246 MiB saved, f16, with 3 checkpoints), so the server skipped it.
        val phone = Phones.MOTO_G96.copy(availableRamBytes = 2_904_868_496)
        val full = auto(Phones.QWEN_08B.with(ServeChoices(kvCache = KvCacheChoice.FULL)), phone)
        assertEquals(88, full.promptCacheMiB)
        assertEquals(0, full.savedPrompts)
        // Auto: half-size notes leave 268 MiB, room for one saved chat (a state at half the context, 198 MiB) and
        // for any chat up to 27k tokens: that same chat is 167 MiB at half size.
        val plan = auto(Phones.QWEN_08B, phone)
        assertTrue(plan.halfKvCache)
        assertEquals(32_768, plan.context)
        assertEquals(847_433_984, plan.needBytes)
        assertEquals(268, plan.promptCacheMiB)
        assertEquals(1, plan.savedPrompts)
        assertTrue(plan.freeMemoryLimits)
        assertTrue(14_384 * 6_528L + 4 * 20_201_472 <= plan.promptCacheMiB * mib)
        assertEquals(listOf("q8_0"), LlamaCppRuntime.plan(request(Phones.QWEN_08B, phone)).argv.after("--cache-type-k"))
        // Every share gives the same here: free memory, not the share, is the limit.
        fun what(p: ContextPlan) = listOf(p.context, p.halfKvCache, p.promptCacheMiB, p.savedPrompts, p.freeMemoryLimits)
        for (share in RamShare.entries) assertEquals(what(plan), what(auto(Phones.QWEN_08B.with(ServeChoices(ramShare = share)), phone)), "$share")
        // No saved chats wanted: no reason for half size.
        assertFalse(auto(Phones.QWEN_08B.with(ServeChoices(savedPrompts = 0)), phone).halfKvCache)
    }

    @Test
    fun `the RAM share sets the budget, the context and the verdict`() {
        val moto = Phones.MOTO_G96_IDLE
        // A third of 7.2 GiB holds not even the 4B's 16k, 8-bit.
        val less = auto(Phones.QWEN_4B.with(ServeChoices(ramShare = RamShare.LESS)), moto)
        assertEquals(RamVerdict.Refused(3_289_605_280, RamGate.budget(moto.totalRamBytes, RamShare.LESS)), less.ram)
        // Two thirds hold its 32k with a full-size cache.
        val more = auto(Phones.QWEN_4B.with(ServeChoices(ramShare = RamShare.MORE)), moto)
        assertEquals(32_768, more.context)
        assertFalse(more.halfKvCache)
        assertEquals(RamVerdict.Fits(4_078_134_432, RamGate.budget(moto.totalRamBytes, RamShare.MORE)), more.ram)
        // The 0.8B with less: what is spare is a third of the phone at most, so 45k.
        assertEquals(46_080, auto(Phones.QWEN_08B.with(ServeChoices(ramShare = RamShare.LESS)), moto).context)
        assertThrows<LmeException.NotEnoughMemory> { LlamaCppRuntime.plan(request(Phones.QWEN_4B.with(ServeChoices(ramShare = RamShare.LESS)))) }
    }

    @Test
    fun `the KV cache is 8-bit when the user asks, never when the heads do not allow it`() {
        val moto = Phones.MOTO_G96_IDLE
        // Full on the 4B: the budget holds 25k.
        val full = auto(Phones.QWEN_4B.with(ServeChoices(kvCache = KvCacheChoice.FULL)), moto)
        assertEquals(25_600, full.context)
        assertFalse(full.halfKvCache)
        // Half on Gemma: half the window's cache too, so 38k with room for two more.
        val gemma = Phones.GEMMA_E2B.with(ServeChoices(kvCache = KvCacheChoice.HALF))
        assertEquals(38_912, auto(gemma, moto).context)
        assertEquals(listOf("q8_0"), LlamaCppRuntime.plan(request(gemma)).argv.after("--cache-type-v"))
        // Heads of 80 values are not whole blocks: f16, whatever is asked.
        val odd = Phones.model("odd", 2_740_937_888, KvCacheShape(16_384, 0, null, 13_172_736, quantizable = false), 262_144)
        for (choice in KvCacheChoice.entries) assertFalse(auto(odd.with(ServeChoices(kvCache = choice)), moto).halfKvCache, "$choice")
        assertFalse("--cache-type-k" in LlamaCppRuntime.plan(request(Phones.QWEN_08B)).argv)
    }

    @Test
    fun `saved prompts, checkpoints and threads follow the user's choices, within their ranges`() {
        val moto = Phones.MOTO_G96_IDLE
        fun plan(serve: ServeChoices) = auto(Phones.QWEN_08B.with(serve), moto)
        // No saved prompts: no cache, and the context may grow to 64k on its own.
        val none = plan(ServeChoices(savedPrompts = 0))
        assertEquals(0, none.promptCacheMiB)
        assertEquals(listOf("0"), LlamaCppRuntime.plan(request(Phones.QWEN_08B.with(ServeChoices(savedPrompts = 0)))).argv.after("--cache-ram"))
        // Three: room for three keeps the context to 52k.
        val three = plan(ServeChoices(savedPrompts = 3))
        assertEquals(53_248, three.context)
        assertEquals(3, three.savedPrompts)
        assertEquals(plan(ServeChoices(savedPrompts = 3)), plan(ServeChoices(savedPrompts = 9)))
        // Checkpoints: each one more copy of the recurrent state (19.3 MiB on the 0.8B), kept within 2 to 8.
        assertEquals(1_519_636_736, plan(ServeChoices(checkpoints = 8)).needBytes)
        assertEquals(1_398_427_904, plan(ServeChoices(checkpoints = 2)).needBytes)
        assertEquals(2, plan(ServeChoices(checkpoints = 1)).checkpoints)
        assertEquals(8, plan(ServeChoices(checkpoints = 30)).checkpoints)
        // A dense model gets none, whatever is asked.
        val dense = Phones.model("dense", 1_000_000_000, KvCacheShape(16_384, 0, null, quantizable = true), 262_144)
        assertNull(auto(dense.with(ServeChoices(checkpoints = 8)), moto).checkpoints)
        // Threads: the big cores, else the user's count, at most the phone's cores.
        assertEquals(4, plan(ServeChoices.AUTO).threads)
        assertEquals(2, plan(ServeChoices(threads = 2)).threads)
        assertEquals(8, plan(ServeChoices(threads = 64)).threads)
        assertEquals(listOf("6"), LlamaCppRuntime.plan(request(Phones.QWEN_08B.with(ServeChoices(threads = 6)))).argv.after("--threads"))
    }

    @Test
    fun `the detailed log adds the trace and the slots' token diff, and only then`() {
        val on = LlamaCppRuntime.plan(request(Phones.QWEN_08B.with(ServeChoices(detailedLog = true))))
        assertEquals(mapOf("LLAMA_API_KEY" to key, "LLAMA_ARG_LOG_VERBOSITY" to "4", "LLAMA_SERVER_SLOTS_DEBUG" to "1"), on.env)
        assertEquals(mapOf("LLAMA_API_KEY" to key), LlamaCppRuntime.plan(request(Phones.QWEN_08B)).env)
        assertFalse(key in on.toString())
    }

    @Test
    fun `too big, too small a phone, or the wrong CPU is refused`() {
        val e = assertThrows<LmeException.NotEnoughMemory> { LlamaCppRuntime.plan(request(Phones.QWEN_9B)) }
        assertEquals(6_229_189_856, e.needed)
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
            for (m in listOf(Phones.GEMMA_E2B, Phones.QWEN_4B)) {
                val plan = LlamaCppRuntime.plan(request(m, device))
                val sizing = auto(m, device)
                assertEquals(sizing.context, plan.contextSize)
                assertEquals(sizing.promptCacheMiB, plan.promptCacheMiB)
                assertEquals(sizing.totalBytes, plan.totalBytes)
                assertEquals(sizing.ram, plan.ram)
                assertEquals(sizing.threads, plan.threads)
                assertEquals(if (sizing.halfKvCache) listOf("q8_0") else emptyList(), plan.argv.after("--cache-type-k"))
                val files = ServerMemory.filesOnly(m.sizeBytes)
                assertEquals(LlamaCppRuntime.memoryNeed(m.sizeBytes, m.shape.kvCache, sizing.context, sizing.halfKvCache, memory = files), sizing.needBytes)
            }
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
        assertThrows<IllegalArgumentException> { LlamaCppRuntime.serve("/s", "/m.gguf", "m", 16_384, ServerTuning.DEFAULT, 8099, 0, key) }
        assertThrows<IllegalArgumentException> { LlamaCppRuntime.serve("/s", "/m.gguf", "m", 0, ServerTuning.DEFAULT, 8099, 4, key) }
        assertThrows<IllegalArgumentException> { ServerTuning(promptCacheMiB = -1) }
        assertThrows<IllegalArgumentException> { ServerTuning(checkpoints = 0) }
    }

    @Test
    fun `the plan runs the server command, which needs no phone`() {
        val plan = LlamaCppRuntime.plan(request())
        val model = Phones.QWEN_4B
        val sizing = auto(model, Phones.MOTO_G96_IDLE)
        val tuning = ServerTuning(sizing.promptCacheMiB, sizing.checkpoints, KvCacheType.Q8_0)
        val server = LlamaCppRuntime.serve(lib, plan.argv[2], model.id, plan.contextSize, tuning, 8099, 4, key)
        assertEquals(plan.argv, server.argv)
        assertEquals(plan.env, server.env)
        assertEquals(plan.healthUrl, server.healthUrl)
        assertEquals(plan.endpoint, server.endpoint)
        assertFalse(key in server.toString())
        // An x86 CI host, no device: the same flags, its own thread count, the server's own prompt cache and KV cache.
        val host = LlamaCppRuntime.serve("/opt/llama-server", "/m/q.gguf", "q", 4_096, ServerTuning.DEFAULT, 18080, 8, key)
        assertEquals(listOf("4096"), host.argv.after("--ctx-size"))
        assertEquals(listOf("0"), host.argv.after("--slot-prompt-similarity"))
        assertEquals(listOf("8"), host.argv.after("--threads"))
        assertEquals("--no-ui", host.argv.last())
        assertFalse(listOf("--cache-ram", "--ctx-checkpoints", "--cache-type-k").any { it in host.argv })
        assertEquals(4_096, host.contextSize)
    }

    @Test
    fun `memory need is files plus one prompt's state, with the files alone`() {
        val q = Phones.QWEN_4B
        fun files(bytes: Long) = ServerMemory.filesOnly(bytes)
        // The KV cache, the recurrent state (50.25 MiB) and 4 checkpoints, each a copy of it; 8-bit, 34 bytes per 32 values.
        assertEquals(2_740_937_888 + 536_870_912 + 5 * 52_690_944, LlamaCppRuntime.memoryNeed(q.sizeBytes, q.shape.kvCache, 16_384, memory = files(q.sizeBytes)))
        assertEquals(
            2_740_937_888 + 285_212_672 + 5 * 52_690_944,
            LlamaCppRuntime.memoryNeed(q.sizeBytes, q.shape.kvCache, 16_384, half = true, memory = files(q.sizeBytes)),
        )
        // Gemma 4 E2B: its checkpoints copy the window layers' KV cache (12 MiB each).
        val g = Phones.GEMMA_E2B
        assertEquals(3_106_738_272 + 113_246_208 + 4 * 12_582_912, LlamaCppRuntime.memoryNeed(g.sizeBytes, g.shape.kvCache, 16_384, memory = files(g.sizeBytes)))
        // A dense model: its KV cache alone.
        assertEquals(2 * gib + 536_870_912, LlamaCppRuntime.memoryNeed(2 * gib, KvCacheShape(16_384, 0, null), 16_384, memory = files(2 * gib)))
        assertEquals(6 * gib, LlamaCppRuntime.memoryNeed(6 * gib, KvCacheShape.NONE, 262_144, memory = files(6 * gib)))
        // By default, before a measurement: the files twice and the estimated compute buffer (2 KiB a token past 342 MB).
        assertEquals(
            2 * 2_740_937_888 + 2_740_937_888 / 8 + 16_384 * 2_048 + 536_870_912 + 5 * 52_690_944,
            LlamaCppRuntime.memoryNeed(q.sizeBytes, q.shape.kvCache, 16_384),
        )
    }

    @Test
    fun `a model with recurrent or windowed layers keeps few checkpoints, a dense one gets the server's default`() {
        assertEquals(RamRules.CONTEXT_CHECKPOINTS, LlamaCppRuntime.contextCheckpoints(Phones.QWEN_4B.shape.kvCache))
        assertEquals(RamRules.CONTEXT_CHECKPOINTS, LlamaCppRuntime.contextCheckpoints(Phones.GEMMA_E2B.shape.kvCache))
        assertNull(LlamaCppRuntime.contextCheckpoints(KvCacheShape(16_384, 0, null)))
        // A window whose layers we do not know is counted both ways, and gets them too.
        assertEquals(RamRules.CONTEXT_CHECKPOINTS, LlamaCppRuntime.contextCheckpoints(KvCacheShape(16_384, 16_384, 4_096)))
        assertEquals(listOf("4"), LlamaCppRuntime.plan(request(Phones.GEMMA_E2B)).argv.after("--ctx-checkpoints"))
        val dense = Phones.model("dense", 1_000_000_000, KvCacheShape(16_384, 0, null), 262_144)
        assertFalse("--ctx-checkpoints" in LlamaCppRuntime.plan(request(dense)).argv)
    }
}
