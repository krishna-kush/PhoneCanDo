package com.phonecando.pce.api

/**
 * Public PCE facade. One instance owns one current snapshot and one
 * backend; it has no global state and can be embedded in any host.
 */
interface PhoneControlEngine {
    suspend fun observe(options: ObserveOptions = ObserveOptions()): PceResult<Snapshot>

    fun resolve(snapshotId: SnapshotId, selector: Selector): PceResult<ResolvedNode>

    suspend fun act(
        snapshotId: SnapshotId,
        action: Action,
        options: ActOptions = ActOptions(),
    ): PceResult<ActionResult>

    suspend fun close()
}
