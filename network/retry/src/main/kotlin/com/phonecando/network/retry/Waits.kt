package com.phonecando.network.retry

import com.phonecando.network.CancelSignal
import com.phonecando.network.NetException

/** Waits that a cancel cuts short. */
object Waits {
    private const val SLICE_MILLIS = 250L

    /**
     * Sleeps [millis] in short slices with [sleeper], so a cancel (or a
     * thread interrupt) lands within a quarter second.
     *
     * @throws NetException.Cancelled when [cancel] is set, before, during or after
     */
    fun sleep(millis: Long, cancel: CancelSignal, sleeper: (Long) -> Unit = Thread::sleep) {
        var left = millis
        while (left > 0) {
            if (cancel.isCancelled()) throw NetException.Cancelled()
            val slice = minOf(left, SLICE_MILLIS)
            try {
                sleeper(slice)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                throw NetException.Cancelled()
            }
            left -= slice
        }
        if (cancel.isCancelled()) throw NetException.Cancelled()
    }
}
