package com.phonecando.network

/** Checked between units of work; a cancelled job throws [NetException.Cancelled] (or its engine's own). */
fun interface CancelSignal {
    fun isCancelled(): Boolean

    companion object {
        val NEVER = CancelSignal { false }
    }
}
