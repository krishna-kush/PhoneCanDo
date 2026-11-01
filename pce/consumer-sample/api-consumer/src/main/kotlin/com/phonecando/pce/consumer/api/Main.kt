package com.phonecando.pce.consumer.api

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.Selector

/**
 * API-only consumer: implements the backend boundary without pulling in the
 * core runtime. A real backend adapts Android accessibility, IME, or a test
 * fake here.
 */
private class NoopBackend : Backend {
    override val id = "noop"
    override val capabilities = setOf(Capability.OBSERVE)

    override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> =
        PceResult.Err(
            PceError(
                ErrorCode.BACKEND_UNAVAILABLE,
                "This API-only sample has no platform backend",
            )
        )

    override suspend fun execute(action: BackendAction): PceResult<Unit> =
        PceResult.Err(
            PceError(
                ErrorCode.UNSUPPORTED_ACTION,
                "This API-only sample has no platform backend",
            )
        )
}

fun main() {
    val backend: Backend = NoopBackend()
    val selector = Selector(text = "Add")
    println("api-only backend=${backend.id} capabilities=${backend.capabilities} selector=$selector")
}
