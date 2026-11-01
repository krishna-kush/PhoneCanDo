@file:OptIn(com.phonecando.pce.api.ExperimentalPceApi::class)

package com.phonecando.pce.api

enum class TraceKind {
    OBSERVE,
    RESOLVE,
    ACTION,
    CLOSE,
}

/**
 * One PCE step. Traces are in-memory contracts; a host can persist or
 * expose them without the PCE knowing about storage.
 */
@ExperimentalPceApi
data class TraceEvent(
    val sequence: Long,
    val atMs: Long,
    val kind: TraceKind,
    val snapshotId: SnapshotId? = null,
    val action: Action? = null,
    val selector: Selector? = null,
    val nodeId: NodeId? = null,
    val backend: String? = null,
    val durationMs: Long? = null,
    val error: PceError? = null,
    val message: String? = null,
)

@ExperimentalPceApi
fun interface TraceSink {
    fun record(event: TraceEvent)
}

@ExperimentalPceApi
object NoopTraceSink : TraceSink {
    override fun record(event: TraceEvent) = Unit
}
