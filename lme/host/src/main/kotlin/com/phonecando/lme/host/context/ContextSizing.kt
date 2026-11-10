package com.phonecando.lme.host.context

/**
 * The automatic context: the model's trained context when its files plus
 * its KV cache at that size fit what the phone can spare; else the largest
 * multiple of [STEP] that does; never below the range's floor. A model
 * whose trained context is unknown keeps the floor. Pure: the runtime
 * passes its own KV cost.
 */
object ContextSizing {
    /** The least we serve: an agent's own prompt can be 15k tokens. */
    const val FLOOR = 16_384L

    /** Contexts below the trained one are whole multiples of this. */
    const val STEP = 1_024L

    /**
     * The largest context in [range] whose need ([sizeBytes] plus
     * [kvBytes] at that context, which never shrinks as the context grows)
     * fits [spareBytes]: [ContextRange.max] when that fits, else a multiple
     * of [STEP]; [ContextRange.min] when nothing above it fits.
     */
    fun automatic(spareBytes: Long, sizeBytes: Long, range: ContextRange, kvBytes: (Long) -> Long): Long {
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
