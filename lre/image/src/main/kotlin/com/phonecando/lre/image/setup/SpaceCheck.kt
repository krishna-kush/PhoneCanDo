package com.phonecando.lre.image.setup

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.LreException

/** Whether an unpacked base fits. Pure. */
object SpaceCheck {
    /**
     * Bytes an unpacked [base] needs: about 2.5x its compressed layers. A
     * layer of unknown size counts as 0, so a base with no sizes is not
     * checked at all.
     */
    fun estimate(base: BaseImage): Long = base.layers.sumOf { it.size ?: 0L } * 5 / 2

    /** @throws LreException.NoSpace when [needed] exceeds [free]. */
    fun require(needed: Long, free: Long) {
        if (needed > free) throw LreException.NoSpace(needed, free)
    }
}
