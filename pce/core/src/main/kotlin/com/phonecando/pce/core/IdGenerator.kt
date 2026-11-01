package com.phonecando.pce.core

import com.phonecando.pce.api.SnapshotId
import java.util.concurrent.atomic.AtomicLong

fun interface IdGenerator {
    fun next(): SnapshotId
}

/** Thread-safe, monotonic snapshot ids for one PCE instance. */
class AtomicSnapshotIdGenerator(startAt: Long = 1) : IdGenerator {
    private val next = AtomicLong(startAt)

    override fun next(): SnapshotId = SnapshotId(next.getAndIncrement())
}
