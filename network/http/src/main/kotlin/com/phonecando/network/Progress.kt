package com.phonecando.network

/** One progress report of a long job (download, verify, import, unpack, setup). */
data class Progress(val step: String, val done: Long, val total: Long?)

fun interface ProgressSink {
    fun report(progress: Progress)

    companion object {
        val NONE = ProgressSink { }
    }
}
