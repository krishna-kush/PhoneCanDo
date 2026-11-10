package com.phonecando.lme.api

/** One progress report of a long job (download, import, verify). */
data class Progress(val step: String, val done: Long, val total: Long?)

fun interface ProgressSink {
    fun report(progress: Progress)

    companion object {
        val NONE = ProgressSink { }
    }
}

/** Checked between units of work; a cancelled job throws [LmeException.Cancelled]. */
fun interface CancelSignal {
    fun isCancelled(): Boolean

    companion object {
        val NEVER = CancelSignal { false }
    }
}
