package com.phonecando.lme.catalog.suggested

import com.phonecando.lme.host.context.ContextRange
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.lme.host.ram.RamClass
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamRules
import com.phonecando.lme.host.ram.RamVerdict
import org.junit.jupiter.api.Test
import kotlin.reflect.KClass
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The phone sizes `suggested.json` claims (what our website shows), worked
 * out again from lme host's RAM gate, so a change to the rules or to the
 * list fails here until the file follows.
 *
 * Phones are sold by marketed size but report less as total RAM: the
 * kernel and firmware keep some ([RamRules], [RamClass]). We take a phone
 * sold as N GB to report what our 8 GB test phone, Moto g96, does, scaled:
 * MemTotal 7,562,532 kB, 7.21 GiB of 8 (about 90%). [RamClass] reads each
 * back as N GB. A phone that keeps back less may run a model one size down
 * (RamGateTest: a 12 GB phone reporting 11.6 GiB runs Qwen3.5 9B), one that
 * keeps back more may need the next.
 */
class SuggestedRamTest {
    private val motoG96Total = 7_562_532L * 1024

    private fun reported(gb: Int): Long = gb * motoG96Total / 8

    private val sizes = RamRules.MARKETED_GB

    /** The smallest marketed size whose verdict on [needBytes] is one of [ok]. */
    private fun smallest(needBytes: Long, vararg ok: KClass<out RamVerdict>): Int =
        sizes.first { gb -> RamGate.check(reported(gb), needBytes)::class in ok }

    private fun phoneRam(needBytes: Long) =
        PhoneRam(smallest(needBytes, RamVerdict.Tight::class, RamVerdict.Fits::class), smallest(needBytes, RamVerdict.Fits::class))

    @Test
    fun `each phone we model is read back as the size it is sold as`() {
        for (gb in sizes) assertEquals(gb, RamClass.of(reported(gb)), "$gb GB")
        assertEquals(7.21, reported(8) / (1L shl 30).toDouble(), 0.01)
    }

    @Test
    fun `each suggestion's phone sizes are the gate's at the context it is always served with`() {
        val expected = Suggested.MODELS.associate { m ->
            // The least context the app serves it with (the floor, or its trained context when less).
            val context = ContextRange.of(m.contextLength).min
            m.title to phoneRam(LlamaCppRuntime.memoryNeed(m.file.sizeBytes, m.kvCache, context))
        }
        assertEquals(expected, Suggested.MODELS.associate { it.title to it.phoneRam }, "write these into suggested.json")
    }

    @Test
    fun `the floor for any model is the gate's`() {
        // A model of one byte: what the gate allows any model at all.
        assertEquals(phoneRam(1), Suggested.ANY_MODEL, "write this into suggested.json's top-level phoneRam")
        assertEquals(PhoneRam(RamRules.OFFERED_FROM_GB, RamRules.WARN_BELOW_GB), Suggested.ANY_MODEL)
    }

    @Test
    fun `the sizes run up with the need`() {
        for (m in Suggested.MODELS) {
            val ram = m.phoneRam
            assertTrue(ram.runsFromGb in sizes && ram.runsWellFromGb in sizes, m.title)
            assertTrue(Suggested.ANY_MODEL.runsFromGb <= ram.runsFromGb && ram.runsFromGb <= ram.runsWellFromGb, m.title)
        }
    }
}
