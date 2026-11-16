package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.RamShare

/** Whether a model fits a phone, and how much it may take ([RamRules]). Pure. */
object RamGate {
    private const val MIB = 1L shl 20

    /** False below [RamRules.OFFERED_FROM_GB]: the host hides local models. */
    fun offered(totalRamBytes: Long): Boolean = RamClass.of(totalRamBytes) >= RamRules.OFFERED_FROM_GB

    /** What a model may take: its [share] of the phone's total RAM ([RamRules.percent]). */
    fun budget(totalRamBytes: Long, share: RamShare = RamShare.NORMAL): Long = totalRamBytes / 100 * RamRules.percent(share)

    /** What we keep free at a start: [RamRules.KEEP_FREE_PERCENT] of the total plus [RamRules.FREE_MARGIN_MIB]. */
    fun keepFree(totalRamBytes: Long): Long = totalRamBytes / 100 * RamRules.KEEP_FREE_PERCENT + RamRules.FREE_MARGIN_MIB * MIB

    /**
     * What a model may take now: the [budget] for its [share], bounded by
     * the memory free now ([availableRamBytes]) less [keepFree]; never below
     * zero. What the automatic context and the prompt cache are sized by;
     * verdicts stay with the [budget].
     */
    fun spare(totalRamBytes: Long, availableRamBytes: Long, share: RamShare = RamShare.NORMAL): Long =
        minOf(budget(totalRamBytes, share), (availableRamBytes - keepFree(totalRamBytes)).coerceAtLeast(0))

    /**
     * The room for llama-server's prompt cache (`--cache-ram`) once a model
     * that needs [needBytes] takes its share of [spareBytes], in MiB: room
     * for [prompts] whole prompt states of [promptBytes] each ([PromptState]:
     * the agent's chat kept while a request with another prefix, a sub-agent
     * or a title, takes the one slot), when what is left holds that much;
     * else what is left. Files, the slot's state and the prompt cache
     * together stay within [spareBytes]. Zero when there is none (the server
     * then keeps no prompt cache).
     */
    fun promptCacheMiB(spareBytes: Long, needBytes: Long, promptBytes: Long, prompts: Int): Long {
        val wanted = (prompts * promptBytes + MIB - 1) / MIB
        val left = (spareBytes - needBytes).coerceAtLeast(0) / MIB
        return minOf(wanted, left)
    }

    /** The saved chats of [chatBytes] each ([RamRules.SAVED_CHAT_DIVISOR]) a cache of [cacheMiB] holds: at most [prompts]. */
    fun savedChats(cacheMiB: Long, chatBytes: Long, prompts: Int): Int {
        if (chatBytes <= 0) return 0
        return minOf(prompts.toLong(), cacheMiB * MIB / chatBytes).toInt()
    }

    /**
     * The verdict for a model that needs [needBytes] (its files plus one
     * prompt's state, [PromptState]; before a download, the file sizes
     * alone) against the budget for its [share]. A [chosen] context (the
     * user set it) may pass the budget ([RamVerdict.OverBudget]), never the
     * phone's total RAM; anything else is refused past the budget.
     */
    fun check(totalRamBytes: Long, needBytes: Long, chosen: Boolean = false, share: RamShare = RamShare.NORMAL): RamVerdict {
        if (!offered(totalRamBytes)) return RamVerdict.Hidden
        val budget = budget(totalRamBytes, share)
        return when {
            needBytes > (if (chosen) totalRamBytes else budget) -> RamVerdict.Refused(needBytes, budget)
            needBytes > budget -> RamVerdict.OverBudget(needBytes, budget)
            RamClass.of(totalRamBytes) < RamRules.WARN_BELOW_GB -> RamVerdict.Tight(needBytes, budget)
            else -> RamVerdict.Fits(needBytes, budget)
        }
    }
}
