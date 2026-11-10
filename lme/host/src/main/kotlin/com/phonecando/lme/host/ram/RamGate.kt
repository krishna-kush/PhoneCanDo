package com.phonecando.lme.host.ram

/** Whether a model fits a phone, and how much it may take ([RamRules]). Pure. */
object RamGate {
    private const val MIB = 1L shl 20

    /** False below [RamRules.OFFERED_FROM_GB]: the host hides local models. */
    fun offered(totalRamBytes: Long): Boolean = RamClass.of(totalRamBytes) >= RamRules.OFFERED_FROM_GB

    /** What a model may take: [RamRules.BUDGET_PERCENT] of the phone's total RAM. */
    fun budget(totalRamBytes: Long): Long = totalRamBytes / 100 * RamRules.BUDGET_PERCENT

    /**
     * What a model may take now: the [budget], bounded by the memory free
     * now ([availableRamBytes]) less [RamRules.FREE_MARGIN_MIB]; never
     * below zero. What the automatic context and the prompt cache are sized
     * by; verdicts stay with the [budget].
     */
    fun spare(totalRamBytes: Long, availableRamBytes: Long): Long =
        minOf(budget(totalRamBytes), (availableRamBytes - RamRules.FREE_MARGIN_MIB * MIB).coerceAtLeast(0))

    /**
     * The room for llama-server's prompt cache (`--cache-ram`) once a model
     * that needs [needBytes] takes its share of [spareBytes], in whole MiB:
     * files, KV cache and prompt cache together stay within [spareBytes].
     * Zero when there is none (the server then keeps no prompt cache).
     */
    fun promptCacheMiB(spareBytes: Long, needBytes: Long): Long = (spareBytes - needBytes).coerceAtLeast(0) / MIB

    /**
     * The verdict for a model that needs [needBytes] (its files plus its KV
     * cache, [KvBytes]; before a download, the file sizes alone). A
     * [chosen] context (the user set it) may pass the budget
     * ([RamVerdict.OverBudget]), never the phone's total RAM; anything else
     * is refused past the budget.
     */
    fun check(totalRamBytes: Long, needBytes: Long, chosen: Boolean = false): RamVerdict {
        if (!offered(totalRamBytes)) return RamVerdict.Hidden
        val budget = budget(totalRamBytes)
        return when {
            needBytes > (if (chosen) totalRamBytes else budget) -> RamVerdict.Refused(needBytes, budget)
            needBytes > budget -> RamVerdict.OverBudget(needBytes, budget)
            RamClass.of(totalRamBytes) < RamRules.WARN_BELOW_GB -> RamVerdict.Tight(needBytes, budget)
            else -> RamVerdict.Fits(needBytes, budget)
        }
    }
}
