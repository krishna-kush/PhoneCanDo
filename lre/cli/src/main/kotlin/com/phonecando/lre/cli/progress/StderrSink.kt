package com.phonecando.lre.cli.progress

import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import java.io.PrintStream

/** A ProgressSink that prints [ProgressLines] to [err]; stdout stays clean for the JSON. Call [finish] at the end. */
class StderrSink(private val err: PrintStream, private val clock: () -> Long = System::currentTimeMillis) : ProgressSink {
    private val lines = ProgressLines()

    override fun report(progress: Progress) {
        synchronized(lines) { lines.next(progress, clock()) }.forEach(err::println)
    }

    /** Prints a count still held back. */
    fun finish() {
        synchronized(lines) { lines.flush() }.forEach(err::println)
    }
}
