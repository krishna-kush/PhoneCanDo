package com.phonecando.lme.host.context

/**
 * The automatic context: the most that fits what the phone can spare now,
 * up to [AUTO_MOST] (or the trained context when that is less), never
 * below [AUTO_LEAST] when the budget holds it, never below the range's
 * floor. Below the trained context it is a whole multiple of [STEP]. A
 * model whose trained context is unknown keeps the floor. Pure: the
 * runtime passes its own KV cost.
 */
object ContextSizing {
    /** The least we serve (a context the user may choose): an agent's own prompt can be 15k tokens. */
    const val FLOOR = 16_384L

    /**
     * The least automatic starts with when the budget holds it, whatever is
     * free: agents' own prompts run 13-20k tokens (Claude Code's 15-20k),
     * so at the floor they cannot work. Short of free memory, the runner's
     * memory guard then stops idle agents first.
     */
    const val AUTO_LEAST = 32_768L

    /**
     * The most automatic starts with: a phone CPU reads a prompt at a few
     * thousand tokens a minute (2-5k on the 0.8B), so a session never fills
     * more, and the KV cache of more takes RAM the phone needs.
     */
    const val AUTO_MOST = 65_536L

    /** Contexts below the trained one are whole multiples of this. */
    const val STEP = 1_024L

    /**
     * The automatic context of a model of [sizeBytes] in [range]: the most
     * whose need ([sizeBytes] plus [kvBytes] at that context) fits
     * [spareBytes], up to [AUTO_MOST]; at least the most up to
     * [AUTO_LEAST] that [budgetBytes] holds.
     */
    fun automatic(budgetBytes: Long, spareBytes: Long, sizeBytes: Long, range: ContextRange, kvBytes: (Long) -> Long): Long {
        val least = fitting(budgetBytes, sizeBytes, ContextRange(range.min, minOf(range.max, AUTO_LEAST)), kvBytes)
        val most = fitting(spareBytes, sizeBytes, ContextRange(range.min, minOf(range.max, AUTO_MOST)), kvBytes)
        return maxOf(least, most)
    }

    /**
     * The largest context in [range] whose need ([sizeBytes] plus
     * [kvBytes] at that context, which never shrinks as the context grows)
     * fits [spareBytes]: [ContextRange.max] when that fits, else a multiple
     * of [STEP]; [ContextRange.min] when nothing above it fits.
     */
    fun fitting(spareBytes: Long, sizeBytes: Long, range: ContextRange, kvBytes: (Long) -> Long): Long {
        fun fits(context: Long) = sizeBytes + kvBytes(context) <= spareBytes
        if (fits(range.max)) return range.max
        // Binary search over the steps strictly between the floor and the max.
        var low = (range.min + STEP - 1) / STEP
        var high = (range.max - 1) / STEP
        var best = range.min
        while (low <= high) {
            val mid = (low + high) ushr 1
            if (fits(mid * STEP)) {
                best = mid * STEP
                low = mid + 1
            } else {
                high = mid - 1
            }
        }
        return best
    }
}
