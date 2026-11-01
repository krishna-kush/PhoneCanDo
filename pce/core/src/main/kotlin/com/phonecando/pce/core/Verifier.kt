package com.phonecando.pce.core

import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.ResolvedNode
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot

/**
 * Deterministic postcondition checks over a snapshot. `Assert` uses [exists];
 * hosts can use [absent] and [stable] for their own flows.
 */
class Verifier(private val resolver: Resolver = Resolver()) {
    fun exists(snapshot: Snapshot, selector: Selector): PceResult<ResolvedNode> =
        resolver.resolve(snapshot, selector)

    fun absent(snapshot: Snapshot, selector: Selector): PceResult<Unit> =
        when (val result = resolver.resolve(snapshot, selector)) {
            is PceResult.Ok -> PceResult.Err(
                PceError(
                    code = ErrorCode.ASSERTION_FAILED,
                    message = "Expected no match, but found node ${result.value.node.id}",
                    recovery = Recovery("resolve", "Use a narrower selector or expect existence"),
                )
            )
            is PceResult.Err -> when (result.error.code) {
                ErrorCode.NOT_FOUND -> PceResult.Ok(Unit)
                else -> result
            }
        }

    fun stable(snapshot: Snapshot): PceResult<Unit> =
        if (snapshot.stable) {
            PceResult.Ok(Unit)
        } else {
            PceResult.Err(
                PceError(
                    code = ErrorCode.ASSERTION_FAILED,
                    message = "Snapshot ${snapshot.id} is not stable",
                    recovery = Recovery("observe", "Wait for the UI to settle and observe again"),
                )
            )
        }
}
