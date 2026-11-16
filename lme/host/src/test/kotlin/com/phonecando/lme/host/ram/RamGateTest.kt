package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.RamShare
import com.phonecando.lme.host.context.ContextSizing
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.lme.host.support.Phones
import com.phonecando.lme.host.support.Phones.GEMMA_E2B
import com.phonecando.lme.host.support.Phones.QWEN_08B
import com.phonecando.lme.host.support.Phones.QWEN_4B
import com.phonecando.lme.host.support.Phones.QWEN_9B
import org.junit.jupiter.api.Test
import kotlin.reflect.KClass
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RamGateTest {
    /** The files and one prompt's state at the floor, without copies or compute. */
    private fun need(m: ModelRecord) = LlamaCppRuntime.memoryNeed(m.sizeBytes, m.shape.kvCache, ContextSizing.FLOOR, memory = ServerMemory.filesOnly(m.sizeBytes))

    /**
     * The table: phones by the total RAM they report (GiB), our suggested
     * models as the app plans them there before their first measurement
     * (the estimate, [ServerMemory.estimated]: every weight counted twice,
     * and a compute buffer; at the 16k floor every model gets, 8-bit when
     * f16 cannot reach 32k; the larger automatic context we pick only when
     * the budget holds it never changes a verdict: LlamaCppRuntimeTest). A
     * change of [RamRules] shows here. Once measured on a phone a model gets
     * its own (MeasuredPlanTest); the phone sizes we publish count the files
     * alone (SuggestedRamTest).
     */
    @Test
    fun `the table`() {
        val hidden = RamVerdict.Hidden::class
        val refused = RamVerdict.Refused::class
        val tight = RamVerdict.Tight::class
        val fits = RamVerdict.Fits::class
        val rows: List<Pair<Double, List<KClass<out RamVerdict>>>> = listOf(
            //        0.8B     4B       Gemma E2B  9B
            3.6 to listOf(hidden, hidden, hidden, hidden), // 4 GB
            5.5 to listOf(tight, refused, refused, refused), // 6 GB
            7.21 to listOf(fits, refused, refused, refused), // 8 GB: our Moto g96
            11.2 to listOf(fits, refused, refused, refused), // 12 GB
            11.6 to listOf(fits, refused, refused, refused), // 12 GB, little kept back
            15.0 to listOf(fits, fits, fits, refused), // 16 GB
        )
        for ((gib, expected) in rows) {
            val total = Phones.withRam(gib).totalRamBytes
            val actual = listOf(QWEN_08B, QWEN_4B, GEMMA_E2B, QWEN_9B).map { LlamaCppRuntime.contextPlan(Phones.withRam(gib), it).ram::class }
            assertEquals(expected, actual, "$gib GiB")
        }
    }

    @Test
    fun `the numbers behind the table`() {
        assertEquals(6, RamRules.OFFERED_FROM_GB)
        assertEquals(8, RamRules.WARN_BELOW_GB)
        assertEquals(50, RamRules.BUDGET_PERCENT)
        assertEquals(33, RamRules.LESS_PERCENT)
        assertEquals(66, RamRules.MORE_PERCENT)
        assertEquals(16, RamRules.KEEP_FREE_PERCENT)
        assertEquals(512, RamRules.FREE_MARGIN_MIB)
        assertEquals(4, RamRules.CONTEXT_CHECKPOINTS)
        assertEquals(2..8, RamRules.CHECKPOINTS_RANGE)
        assertEquals(2, RamRules.CACHED_PROMPTS)
        assertEquals(0..3, RamRules.CACHED_PROMPTS_RANGE)
        assertEquals(2, RamRules.SAVED_CHAT_DIVISOR)
        assertEquals(100, RamRules.COPIED_WEIGHTS_PERCENT)
        assertEquals(64, RamRules.COMPUTE_BASE_MIB)
        assertEquals(8, RamRules.COMPUTE_SIZE_DIVISOR)
        assertEquals(2_048, RamRules.COMPUTE_BYTES_PER_TOKEN)
        val moto = Phones.MOTO_G96.totalRamBytes
        assertEquals(3_872_016_350, RamGate.budget(moto))
        // 16% of 7.2 GiB and 512 MiB: 1.65 GiB kept free at a start.
        assertEquals(1_775_916_144, RamGate.keepFree(moto))
        // The 4B at 16k: files, 512 MiB of KV cache, its recurrent state and 4 checkpoints (50.25 MiB each).
        assertEquals(RamVerdict.Fits(2_740_937_888 + 536_870_912 + 5 * 52_690_944, 3_872_016_350), RamGate.check(moto, need(QWEN_4B)))
        assertEquals(RamVerdict.Refused(6_480_848_096, 3_872_016_350), RamGate.check(moto, need(QWEN_9B)))
    }

    @Test
    fun `the RAM share sets the budget, and never takes what the memory guard keeps free`() {
        val moto = Phones.MOTO_G96.totalRamBytes
        assertEquals(listOf(2_555_530_791, 3_872_016_350, 5_111_061_582), RamShare.entries.map { RamGate.budget(moto, it) })
        for (share in RamShare.entries) assertTrue(RamRules.percent(share) + RamRules.KEEP_FREE_PERCENT < 100, "$share")
        // What is spare is the share's budget at most, and never more than what is free less what we keep free.
        assertEquals(RamGate.budget(moto, RamShare.LESS), RamGate.spare(moto, 6L shl 30, RamShare.LESS))
        assertEquals(RamGate.spare(moto, 3L shl 30), RamGate.spare(moto, 3L shl 30, RamShare.MORE))
        val need = 3_000_000_000L
        assertEquals(RamVerdict.Refused(need, RamGate.budget(moto, RamShare.LESS)), RamGate.check(moto, need, share = RamShare.LESS))
        assertEquals(RamVerdict.Fits(need, RamGate.budget(moto, RamShare.MORE)), RamGate.check(moto, need, share = RamShare.MORE))
    }

    @Test
    fun `a chosen context may pass the budget, never the phone's RAM`() {
        val moto = Phones.MOTO_G96.totalRamBytes
        val budget = RamGate.budget(moto)
        assertEquals(RamVerdict.Fits(budget, budget), RamGate.check(moto, budget, chosen = true))
        assertEquals(RamVerdict.OverBudget(budget + 1, budget), RamGate.check(moto, budget + 1, chosen = true))
        assertEquals(RamVerdict.OverBudget(moto, budget), RamGate.check(moto, moto, chosen = true))
        assertEquals(RamVerdict.Refused(moto + 1, budget), RamGate.check(moto, moto + 1, chosen = true))
        // Automatic: past the budget is refused, as before.
        assertEquals(RamVerdict.Refused(budget + 1, budget), RamGate.check(moto, budget + 1))
        // A 6 GB phone warns within the budget, and a phone below the floor is never offered one.
        val six = Phones.withRam(5.5).totalRamBytes
        assertEquals(RamVerdict.Tight(1, RamGate.budget(six)), RamGate.check(six, 1, chosen = true))
        assertEquals(RamVerdict.Hidden, RamGate.check(Phones.withRam(3.6).totalRamBytes, 1, chosen = true))
    }

    @Test
    fun `what a model may take now, and what is left for the prompt cache`() {
        val gib = 1L shl 30
        val mib = 1L shl 20
        val moto = Phones.MOTO_G96.totalRamBytes
        val budget = RamGate.budget(moto)
        // Plenty free: the budget is the bound. Little free: what is free, less what we keep free. None: nothing.
        assertEquals(budget, RamGate.spare(moto, 6 * gib))
        assertEquals(2 * gib - RamGate.keepFree(moto), RamGate.spare(moto, 2 * gib))
        assertEquals(0, RamGate.spare(moto, gib))
        // Room for whole prompt states, rounded up to a MiB, when what is left holds them; else whole MiB of what
        // is left; none when the model takes it all or more, or no prompt is to be kept.
        assertEquals(100, RamGate.promptCacheMiB(budget, budget - 100 * mib - 5, gib, 2))
        assertEquals(128, RamGate.promptCacheMiB(budget, budget - gib, 64 * mib, 2))
        assertEquals(129, RamGate.promptCacheMiB(budget, budget - gib, 64 * mib + 1, 2))
        assertEquals(0, RamGate.promptCacheMiB(budget, budget - mib + 1, gib, 2))
        assertEquals(0, RamGate.promptCacheMiB(budget, budget + gib, gib, 2))
        assertEquals(0, RamGate.promptCacheMiB(budget, budget - gib, 64 * mib, 0))
        // How many saved chats a cache holds, at most as many as wanted.
        assertEquals(2, RamGate.savedChats(128, 32 * mib, 2))
        assertEquals(1, RamGate.savedChats(63, 32 * mib, 2))
        assertEquals(0, RamGate.savedChats(31, 32 * mib, 2))
        assertEquals(0, RamGate.savedChats(128, 32 * mib, 0))
        assertEquals(0, RamGate.savedChats(128, 0, 2))
    }

    @Test
    fun `offered from 6 GB`() {
        assertFalse(RamGate.offered(Phones.withRam(4.0).totalRamBytes))
        assertTrue(RamGate.offered(Phones.withRam(4.01).totalRamBytes))
        assertTrue(RamGate.offered(Phones.MOTO_G96.totalRamBytes))
    }

    @Test
    fun `marketed sizes`() {
        val gib = 1L shl 30
        assertEquals(8, RamClass.of(Phones.MOTO_G96.totalRamBytes))
        assertEquals(6, RamClass.of(5 * gib + 1))
        assertEquals(6, RamClass.of(6 * gib))
        assertEquals(8, RamClass.of(6 * gib + 1))
        assertEquals(12, RamClass.of(11 * gib))
        assertEquals(16, RamClass.of(15 * gib))
        assertEquals(70, RamClass.of(69 * gib + 1))
    }
}
