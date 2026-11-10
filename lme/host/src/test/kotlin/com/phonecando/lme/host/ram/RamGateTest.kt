package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.ModelRecord
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
    private fun need(m: ModelRecord) = LlamaCppRuntime.memoryNeed(m.sizeBytes, m.shape.kvCache, ContextSizing.FLOOR)

    /**
     * The table: phones by the total RAM they report (GiB), our suggested
     * models at the 16k floor every model gets (the larger automatic
     * context we pick only when it fits never changes a verdict:
     * LlamaCppRuntimeTest). A change of [RamRules] shows here.
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
            7.21 to listOf(fits, fits, fits, refused), // 8 GB: our Moto g96
            11.2 to listOf(fits, fits, fits, refused), // 12 GB
            11.6 to listOf(fits, fits, fits, fits), // 12 GB, little kept back
            15.0 to listOf(fits, fits, fits, fits), // 16 GB
        )
        for ((gib, expected) in rows) {
            val total = Phones.withRam(gib).totalRamBytes
            val actual = listOf(QWEN_08B, QWEN_4B, GEMMA_E2B, QWEN_9B).map { RamGate.check(total, need(it))::class }
            assertEquals(expected, actual, "$gib GiB")
        }
    }

    @Test
    fun `the numbers behind the table`() {
        assertEquals(6, RamRules.OFFERED_FROM_GB)
        assertEquals(8, RamRules.WARN_BELOW_GB)
        assertEquals(50, RamRules.BUDGET_PERCENT)
        assertEquals(512, RamRules.FREE_MARGIN_MIB)
        val moto = Phones.MOTO_G96.totalRamBytes
        assertEquals(3_872_016_350, RamGate.budget(moto))
        assertEquals(RamVerdict.Fits(3_277_808_800, 3_872_016_350), RamGate.check(moto, need(QWEN_4B)))
        assertEquals(RamVerdict.Refused(6_217_393_376, 3_872_016_350), RamGate.check(moto, need(QWEN_9B)))
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
        // Plenty free: the budget is the bound. Little free: what is free, less 512 MiB. None: nothing.
        assertEquals(budget, RamGate.spare(moto, 6 * gib))
        assertEquals(2 * gib - 512 * mib, RamGate.spare(moto, 2 * gib))
        assertEquals(0, RamGate.spare(moto, 100 * mib))
        // Whole MiB of what is left; none when the model takes it all or more.
        assertEquals(100, RamGate.promptCacheMiB(budget, budget - 100 * mib - 5))
        assertEquals(0, RamGate.promptCacheMiB(budget, budget - mib + 1))
        assertEquals(0, RamGate.promptCacheMiB(budget, budget + gib))
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
