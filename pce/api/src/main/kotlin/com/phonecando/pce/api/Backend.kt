package com.phonecando.pce.api

enum class Capability {
    OBSERVE,
    TAP,
    LONG_PRESS,
    SET_TEXT,
    KEY,
    SCROLL,
    SWIPE,
    LAUNCH,
    SCREENSHOT,
}

data class ObserveOptions(
    val includeInvisible: Boolean = false,
    val includeWindows: Boolean = true,
    /** Ask the backend for a screenshot artifact; unsupported backends return an error. */
    val screenshot: Boolean = false,
    val maxNodes: Int = 500,
    val timeoutMs: Long = 5_000,
)

data class ActOptions(
    /** Wait budget for [Action.Wait]; backend execution timeouts are backend-owned. */
    val timeoutMs: Long = 30_000,
)

data class ActionResult(
    val snapshotId: SnapshotId,
    val action: Action,
    val backend: String,
    val durationMs: Long,
)

data class ResolvedNode(
    val snapshotId: SnapshotId,
    val node: Node,
    val score: Int,
)

/**
 * The only platform boundary. `api`, `core`, `json` and `testkit` never see
 * Android classes; Android, IME and Shizuku modules implement this.
 */
interface Backend {
    val id: String
    val capabilities: Set<Capability>

    suspend fun observe(options: ObserveOptions = ObserveOptions()): PceResult<RawSnapshot>

    suspend fun execute(action: BackendAction): PceResult<Unit>

    suspend fun close() {}
}
