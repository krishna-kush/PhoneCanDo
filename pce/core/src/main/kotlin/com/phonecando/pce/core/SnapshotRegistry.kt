package com.phonecando.pce.core

import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.SnapshotId
import java.util.concurrent.atomic.AtomicReference

/**
 * Owns the current snapshot for one PCE. Only the latest snapshot is
 * actionable; older ids are rejected as stale instead of silently acting on a
 * changed screen.
 */
internal class SnapshotRegistry {
    private val current = AtomicReference<Snapshot?>(null)

    fun put(snapshot: Snapshot) {
        current.set(snapshot)
    }

    fun current(): Snapshot? = current.get()

    fun get(id: SnapshotId): PceResult<Snapshot> {
        val snapshot = current.get()
            ?: return PceResult.Err(
                PceError(
                    code = ErrorCode.STALE_SNAPSHOT,
                    message = "No snapshot has been observed yet",
                    recovery = Recovery("observe"),
                )
            )
        if (snapshot.id != id) {
            return PceResult.Err(
                PceError(
                    code = ErrorCode.STALE_SNAPSHOT,
                    message = "Snapshot $id is stale; current snapshot is ${snapshot.id}",
                    recovery = Recovery("observe", "Re-observe and resolve against the new snapshot id"),
                )
            )
        }
        return PceResult.Ok(snapshot)
    }

    fun clear() {
        current.set(null)
    }
}
