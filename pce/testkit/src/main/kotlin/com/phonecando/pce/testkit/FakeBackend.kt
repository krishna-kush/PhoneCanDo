package com.phonecando.pce.testkit

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.RawSnapshot

/**
 * Deterministic in-memory backend for tests and samples. It records every
 * executed action so a test can assert what the PCE actually sent.
 */
class FakeBackend(
    private var snapshot: RawSnapshot = Fixtures.rawSnapshot(),
    override val capabilities: Set<Capability> = Capability.entries.toSet(),
    private val onExecute: (BackendAction) -> PceResult<Unit> = { PceResult.Ok(Unit) },
) : Backend {
    override val id: String = "fake"

    val executed = mutableListOf<BackendAction>()
    var observations: Int = 0
        private set
    var lastObserveOptions: ObserveOptions? = null
        private set
    var closed: Boolean = false
        private set

    override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> {
        observations++
        lastObserveOptions = options
        return PceResult.Ok(snapshot)
    }

    override suspend fun execute(action: BackendAction): PceResult<Unit> {
        executed += action
        return onExecute(action)
    }

    override suspend fun close() {
        closed = true
    }

    fun setSnapshot(next: RawSnapshot) {
        snapshot = next
    }
}
