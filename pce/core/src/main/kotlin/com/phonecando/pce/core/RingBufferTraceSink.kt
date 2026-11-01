@file:OptIn(com.phonecando.pce.api.ExperimentalPceApi::class)

package com.phonecando.pce.core

import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.TraceEvent
import com.phonecando.pce.api.TraceSink

/** Bounded in-memory trace. Old events fall out; no disk or Android needed. */
@ExperimentalPceApi
class RingBufferTraceSink(private val capacity: Int = 100) : TraceSink {
    init {
        require(capacity > 0) { "trace capacity must be positive" }
    }

    private val events = ArrayDeque<TraceEvent>(capacity)
    private val lock = Any()

    override fun record(event: TraceEvent) {
        synchronized(lock) {
            if (events.size == capacity) events.removeFirst()
            events.addLast(event)
        }
    }

    fun snapshot(): List<TraceEvent> = synchronized(lock) { events.toList() }

    fun last(count: Int): List<TraceEvent> = synchronized(lock) {
        events.toList().takeLast(count.coerceAtLeast(0))
    }

    fun clear() {
        synchronized(lock) { events.clear() }
    }

    val size: Int
        get() = synchronized(lock) { events.size }
}
