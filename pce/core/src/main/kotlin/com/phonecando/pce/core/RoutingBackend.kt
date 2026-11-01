package com.phonecando.pce.core

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.Recovery

/**
 * Capability router that composes several [Backend]s into one.
 *
 * Observation uses the first backend that declares [Capability.OBSERVE]. Text
 * uses an observing backend first because it honors the resolved node; a
 * text-only backend such as the IME is the fallback. The IME ignores the
 * resolved node, so the target field must already be focused. Enter/Delete
 * prefer the text-only backend, while Back/Home/Recents prefer the observing
 * backend. Other actions use constructor order.
 *
 * A fallback is attempted only for [ErrorCode.UNSUPPORTED_ACTION] and
 * [ErrorCode.BACKEND_UNAVAILABLE]. Other errors are returned unchanged so an
 * action is never repeated after an ambiguous failure.
 *
 * The observed snapshot's `backend` is rewritten to [id] because the router is
 * the backend the PCE sees.
 */
@ExperimentalPceApi
class RoutingBackend(
    private val backends: List<Backend>,
) : Backend {
    init {
        require(backends.isNotEmpty()) { "RoutingBackend needs at least one backend" }
    }

    override val id: String = "router"

    override val capabilities: Set<Capability> =
        backends.flatMapTo(linkedSetOf()) { it.capabilities }

    override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> {
        val candidates = capable(Capability.OBSERVE)
        if (candidates.isEmpty()) {
            return unsupported("No backend can observe")
        }

        var last: PceError? = null
        for (backend in candidates) {
            when (val result = backend.observe(options)) {
                is PceResult.Ok -> return PceResult.Ok(result.value.copy(backend = id))
                is PceResult.Err -> {
                    last = result.error
                    if (!canFallback(result.error.code)) return result
                }
            }
        }
        return PceResult.Err(last ?: unavailable("No backend observed"))
    }

    override suspend fun execute(action: BackendAction): PceResult<Unit> {
        val candidates = candidatesFor(action)
        if (candidates.isEmpty()) {
            return unsupported("No backend can execute $action")
        }

        var last: PceError? = null
        for (backend in candidates) {
            when (val result = backend.execute(action)) {
                is PceResult.Ok -> return result
                is PceResult.Err -> {
                    last = result.error
                    if (!canFallback(result.error.code)) return result
                }
            }
        }
        return PceResult.Err(last ?: unavailable("No backend executed $action"))
    }

    override suspend fun close() {
        var first: Throwable? = null
        for (backend in backends) {
            try {
                backend.close()
            } catch (failure: Exception) {
                if (first == null) first = failure
            }
        }
        first?.let { throw it }
    }

    private fun candidatesFor(action: BackendAction): List<Backend> = when (action) {
        is BackendAction.SetText -> observingFirst(Capability.SET_TEXT)
        is BackendAction.Key -> keyCandidates(action.key)
        is BackendAction.Tap -> capable(Capability.TAP)
        is BackendAction.LongPress -> capable(Capability.LONG_PRESS)
        is BackendAction.Scroll -> capable(Capability.SCROLL)
        is BackendAction.Swipe -> capable(Capability.SWIPE)
        is BackendAction.Launch -> capable(Capability.LAUNCH)
        is BackendAction.Screenshot -> capable(Capability.SCREENSHOT)
    }

    private fun keyCandidates(key: KeyCode): List<Backend> = when (key) {
        KeyCode.BACK, KeyCode.HOME, KeyCode.RECENTS -> observingFirst(Capability.KEY)
        KeyCode.ENTER, KeyCode.DELETE -> textOnlyFirst(Capability.KEY)
        KeyCode.TAB, KeyCode.ESCAPE,
        KeyCode.UP, KeyCode.DOWN, KeyCode.LEFT, KeyCode.RIGHT -> capable(Capability.KEY)
    }

    private fun capable(capability: Capability): List<Backend> =
        backends.filter { capability in it.capabilities }

    private fun observingFirst(capability: Capability): List<Backend> {
        val (observing, other) = capable(capability).partition {
            Capability.OBSERVE in it.capabilities
        }
        return observing + other
    }

    private fun textOnlyFirst(capability: Capability): List<Backend> {
        val (textOnly, other) = capable(capability).partition {
            Capability.OBSERVE !in it.capabilities
        }
        return textOnly + other
    }

    private fun canFallback(code: ErrorCode): Boolean =
        code == ErrorCode.UNSUPPORTED_ACTION || code == ErrorCode.BACKEND_UNAVAILABLE

    private fun unsupported(message: String): PceResult.Err =
        PceResult.Err(
            PceError(
                code = ErrorCode.UNSUPPORTED_ACTION,
                message = message,
                recovery = Recovery("observe", "Check the available backends and capabilities"),
            )
        )

    private fun unavailable(message: String): PceError =
        PceError(
            code = ErrorCode.BACKEND_UNAVAILABLE,
            message = message,
            recovery = Recovery("observe", "Check the available backends"),
        )
}
