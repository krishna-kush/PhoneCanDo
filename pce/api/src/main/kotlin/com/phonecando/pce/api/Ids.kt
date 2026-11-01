package com.phonecando.pce.api

/**
 * Identifies one captured snapshot for one PCE instance.
 *
 * A snapshot id is never reused. Actions always carry the snapshot they were
 * resolved against so a backend can reject stale input.
 */
@JvmInline
value class SnapshotId(val value: Long) {
    init {
        require(value > 0) { "snapshot id must be positive" }
    }

    override fun toString(): String = value.toString()
}

/**
 * Dense node id inside one [Snapshot]. `NodeId(0)` is the first node in
 * [Snapshot.nodes]; `NodeId(i)` is always `Snapshot.nodes[i].id`.
 */
@JvmInline
value class NodeId(val value: Int) {
    init {
        require(value >= 0) { "node id must not be negative" }
    }

    override fun toString(): String = value.toString()
}

/**
 * Backend-owned node identity. The core never exposes this as a stable API
 * identity; it is only used to translate a resolved node back to the backend
 * that produced it.
 */
@JvmInline
value class BackendNodeId(val value: String) {
    override fun toString(): String = value
}
