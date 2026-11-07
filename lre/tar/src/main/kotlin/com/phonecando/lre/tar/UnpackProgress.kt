package com.phonecando.lre.tar

import com.phonecando.lre.api.Progress
import com.phonecando.lre.api.ProgressSink

/**
 * Reports bytes read from the caller's (compressed) stream as step
 * [STEP], at most once per [INTERVAL] bytes. The total stays null: only the
 * caller knows the layer's size.
 */
internal class UnpackProgress(private val sink: ProgressSink) {
    private var reported = -1L

    fun update(done: Long) {
        if (reported < 0 || done - reported >= INTERVAL) report(done)
    }

    fun finish(done: Long) = report(done)

    private fun report(done: Long) {
        reported = done
        sink.report(Progress(STEP, done, null))
    }

    companion object {
        const val STEP = "unpack"
        private const val INTERVAL = 1L shl 20
    }
}
