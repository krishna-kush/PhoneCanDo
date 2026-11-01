@file:OptIn(com.phonecando.pce.api.ExperimentalPceApi::class)

package com.phonecando.pce.core

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.ActOptions
import com.phonecando.pce.api.ActionResult
import com.phonecando.pce.api.PhoneControlEngine
import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.Clock
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.NoopTraceSink
import com.phonecando.pce.api.NodeId
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.ResolvedNode
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.SnapshotId
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.TraceEvent
import com.phonecando.pce.api.TraceKind
import com.phonecando.pce.api.TraceSink
import com.phonecando.pce.api.map
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Default PCE implementation. One instance owns one backend, one current
 * snapshot and one id sequence; create a separate instance for another host or
 * test.
 */
class Pce private constructor(
    private val backend: Backend,
    private val clock: Clock,
    private val idGenerator: IdGenerator,
    private val resolver: Resolver,
    private val verifier: Verifier,
    private val trace: TraceSink,
) : PhoneControlEngine {
    private val registry = SnapshotRegistry()
    private val traceSequence = AtomicLong(0)
    private val lane = Mutex()

    override suspend fun observe(options: ObserveOptions): PceResult<Snapshot> =
        lane.withLock { observeInternal(options) }

    private suspend fun observeInternal(options: ObserveOptions): PceResult<Snapshot> {
        val started = clock.nowMs()
        capabilityError(Capability.OBSERVE)?.let { error ->
            record(TraceKind.OBSERVE, started, error = error)
            return PceResult.Err(error)
        }

        val raw = when (val result = backend.observe(options)) {
            is PceResult.Ok -> result.value
            is PceResult.Err -> {
                record(TraceKind.OBSERVE, started, error = result.error)
                return result
            }
        }
        val assembled = SnapshotAssembler.assemble(raw, idGenerator.next(), clock.nowMs())
        val snapshot = when (assembled) {
            is PceResult.Ok -> assembled.value
            is PceResult.Err -> {
                record(TraceKind.OBSERVE, started, error = assembled.error)
                return assembled
            }
        }
        registry.put(snapshot)
        record(TraceKind.OBSERVE, started, snapshotId = snapshot.id)
        return PceResult.Ok(snapshot)
    }

    override fun resolve(snapshotId: SnapshotId, selector: Selector): PceResult<ResolvedNode> {
        val started = clock.nowMs()
        val snapshot = when (val result = registry.get(snapshotId)) {
            is PceResult.Ok -> result.value
            is PceResult.Err -> {
                record(TraceKind.RESOLVE, started, snapshotId, selector = selector, error = result.error)
                return result
            }
        }
        val result = resolver.resolve(snapshot, selector)
        when (result) {
            is PceResult.Ok -> record(
                TraceKind.RESOLVE,
                started,
                snapshotId = snapshot.id,
                selector = selector,
                nodeId = result.value.node.id,
            )
            is PceResult.Err -> record(
                TraceKind.RESOLVE,
                started,
                snapshotId = snapshot.id,
                selector = selector,
                error = result.error,
            )
        }
        return result
    }

    override suspend fun act(
        snapshotId: SnapshotId,
        action: Action,
        options: ActOptions,
    ): PceResult<ActionResult> = lane.withLock {
        val started = clock.nowMs()
        val result = actInternal(snapshotId, action, options, started)
        record(
            kind = TraceKind.ACTION,
            started = started,
            snapshotId = (result as? PceResult.Ok)?.value?.snapshotId ?: snapshotId,
            action = action,
            error = (result as? PceResult.Err)?.error,
        )
        result
    }

    private suspend fun actInternal(
        snapshotId: SnapshotId,
        action: Action,
        options: ActOptions,
        started: Long,
    ): PceResult<ActionResult> {
        val snapshot = when (val result = registry.get(snapshotId)) {
            is PceResult.Ok -> result.value
            is PceResult.Err -> return result
        }

        if (action is Action.Assert) {
            return when (val resolved = verifier.exists(snapshot, action.selector)) {
                is PceResult.Ok -> PceResult.Ok(
                    ActionResult(snapshot.id, action, backend.id, clock.nowMs() - started)
                )
                is PceResult.Err -> resolved
            }
        }

        if (action is Action.Wait) {
            capabilityError(Capability.OBSERVE)?.let { return PceResult.Err(it) }
            return waitFor(snapshotId, action, options, started)
        }

        val backendAction = when (action) {
            is Action.Tap -> {
                capabilityError(Capability.TAP)?.let { return PceResult.Err(it) }
                tapAction(resolveTarget(snapshot, action.target))
            }
            is Action.LongPress -> {
                capabilityError(Capability.LONG_PRESS)?.let { return PceResult.Err(it) }
                longPressAction(resolveTarget(snapshot, action.target), action.durationMs)
            }
            is Action.TypeText -> {
                capabilityError(Capability.SET_TEXT)?.let { return PceResult.Err(it) }
                setTextAction(snapshot, action)
            }
            is Action.Key -> {
                capabilityError(Capability.KEY)?.let { return PceResult.Err(it) }
                PceResult.Ok(BackendAction.Key(action.key))
            }
            is Action.Scroll -> {
                capabilityError(Capability.SCROLL)?.let { return PceResult.Err(it) }
                scrollAction(snapshot, action)
            }
            is Action.Swipe -> {
                capabilityError(Capability.SWIPE)?.let { return PceResult.Err(it) }
                swipeAction(action)
            }
            is Action.Screenshot -> {
                capabilityError(Capability.SCREENSHOT)?.let { return PceResult.Err(it) }
                PceResult.Ok(BackendAction.Screenshot(action.full))
            }
            is Action.Launch -> {
                capabilityError(Capability.LAUNCH)?.let { return PceResult.Err(it) }
                launchAction(action)
            }
            is Action.Assert, is Action.Wait -> error("handled above")
        }

        val concrete = when (backendAction) {
            is PceResult.Ok -> backendAction.value
            is PceResult.Err -> return backendAction
        }

        return when (val result = backend.execute(concrete)) {
            is PceResult.Ok -> PceResult.Ok(
                ActionResult(snapshot.id, action, backend.id, clock.nowMs() - started)
            )
            is PceResult.Err -> result
        }
    }

    override suspend fun close() = lane.withLock {
        registry.clear()
        try {
            backend.close()
        } finally {
            record(TraceKind.CLOSE, message = "closed")
        }
    }

    private suspend fun waitFor(
        snapshotId: SnapshotId,
        action: Action.Wait,
        options: ActOptions,
        started: Long,
    ): PceResult<ActionResult> {
        if (action.timeoutMs <= 0 || options.timeoutMs <= 0) {
            return PceResult.Err(
                PceError(ErrorCode.INVALID_ACTION, "Wait timeout must be positive")
            )
        }
        when (val initial = registry.get(snapshotId)) {
            is PceResult.Ok -> Unit
            is PceResult.Err -> return initial
        }

        val deadline = clock.nowMs() + minOf(action.timeoutMs, options.timeoutMs)
        while (true) {
            val snapshot = registry.current()
                ?: return PceResult.Err(
                    PceError(
                        code = ErrorCode.STALE_SNAPSHOT,
                        message = "No current snapshot while waiting",
                        recovery = Recovery("observe"),
                    )
                )
            when (val resolved = resolver.resolve(snapshot, action.selector)) {
                is PceResult.Ok -> return PceResult.Ok(
                    ActionResult(snapshot.id, action, backend.id, clock.nowMs() - started)
                )
                is PceResult.Err -> {
                    if (resolved.error.code != ErrorCode.NOT_FOUND &&
                        resolved.error.code != ErrorCode.AMBIGUOUS
                    ) {
                        return resolved
                    }
                }
            }

            val remaining = deadline - clock.nowMs()
            if (remaining <= 0) {
                return PceResult.Err(
                    PceError(
                        code = ErrorCode.TIMEOUT,
                        message = "Selector did not match within ${action.timeoutMs}ms",
                        recovery = Recovery("observe", "Re-observe and inspect the current screen"),
                    )
                )
            }
            delay(minOf(200L, remaining))
            when (val observed = observeInternal(ObserveOptions())) {
                is PceResult.Ok -> Unit
                is PceResult.Err -> return observed
            }
        }
    }

    private fun tapAction(target: PceResult<ResolvedTarget>): PceResult<BackendAction> =
        when (target) {
            is PceResult.Err -> target
            is PceResult.Ok -> when (val resolved = target.value) {
                is ResolvedTarget.Node -> {
                    val backendId = resolved.node.backendId
                        ?: return PceResult.Err(
                            PceError(
                                ErrorCode.UNSUPPORTED_ACTION,
                                "Node ${resolved.node.id} has no backend identity",
                            )
                        )
                    PceResult.Ok(BackendAction.Tap(backendNodeId = backendId))
                }
                is ResolvedTarget.Coordinates -> PceResult.Ok(BackendAction.Tap(point = resolved.point))
            }
        }

    private fun longPressAction(
        target: PceResult<ResolvedTarget>,
        durationMs: Long,
    ): PceResult<BackendAction> {
        if (durationMs <= 0) {
            return PceResult.Err(PceError(ErrorCode.INVALID_ACTION, "Long press duration must be positive"))
        }
        return when (target) {
            is PceResult.Err -> target
            is PceResult.Ok -> when (val resolved = target.value) {
                is ResolvedTarget.Node -> {
                    val backendId = resolved.node.backendId
                        ?: return PceResult.Err(
                            PceError(
                                ErrorCode.UNSUPPORTED_ACTION,
                                "Node ${resolved.node.id} has no backend identity",
                            )
                        )
                    PceResult.Ok(
                        BackendAction.LongPress(backendNodeId = backendId, durationMs = durationMs)
                    )
                }
                is ResolvedTarget.Coordinates -> PceResult.Ok(
                    BackendAction.LongPress(point = resolved.point, durationMs = durationMs)
                )
            }
        }
    }

    private fun setTextAction(
        snapshot: Snapshot,
        action: Action.TypeText,
    ): PceResult<BackendAction> {
        val target = action.target?.let { resolveTarget(snapshot, it) }
            ?: snapshot.focusedNodeId?.let { id ->
                snapshot.node(id)?.let { PceResult.Ok(ResolvedTarget.Node(it)) }
            }
            ?: PceResult.Err(
                PceError(
                    code = ErrorCode.NOT_FOUND,
                    message = "No focused node for text input",
                    recovery = Recovery("observe", "Pass an explicit editable target"),
                )
            )

        return when (target) {
            is PceResult.Err -> target
            is PceResult.Ok -> when (val resolved = target.value) {
                is ResolvedTarget.Node -> {
                    val node = resolved.node
                    val backendId = node.backendId
                    when {
                        backendId == null -> PceResult.Err(
                            PceError(
                                ErrorCode.UNSUPPORTED_ACTION,
                                "Node ${node.id} has no backend identity",
                            )
                        )
                        !node.editable -> PceResult.Err(
                            PceError(
                                ErrorCode.NOT_EDITABLE,
                                "Node ${node.id} is not editable",
                                Recovery("resolve", "Target an editable node"),
                            )
                        )
                        else -> PceResult.Ok(
                            BackendAction.SetText(backendId, action.text, action.clear)
                        )
                    }
                }
                is ResolvedTarget.Coordinates -> PceResult.Err(
                    PceError(ErrorCode.UNSUPPORTED_ACTION, "Text input needs a node target")
                )
            }
        }
    }

    private fun scrollAction(
        snapshot: Snapshot,
        action: Action.Scroll,
    ): PceResult<BackendAction> {
        if (action.amount <= 0f || action.amount > 1f) {
            return PceResult.Err(
                PceError(ErrorCode.INVALID_ACTION, "Scroll amount must be in (0, 1]")
            )
        }
        val target = action.target?.let { resolveTarget(snapshot, it) }
        return when (target) {
            null -> PceResult.Ok(
                BackendAction.Scroll(
                    backendNodeId = null,
                    direction = action.direction,
                    amount = action.amount,
                )
            )
            is PceResult.Err -> target
            is PceResult.Ok -> when (val resolved = target.value) {
                is ResolvedTarget.Node -> {
                    val backendId = resolved.node.backendId
                        ?: return PceResult.Err(
                            PceError(
                                ErrorCode.UNSUPPORTED_ACTION,
                                "Node ${resolved.node.id} has no backend identity",
                            )
                        )
                    PceResult.Ok(
                        BackendAction.Scroll(
                            backendNodeId = backendId,
                            direction = action.direction,
                            amount = action.amount,
                        )
                    )
                }
                is ResolvedTarget.Coordinates -> PceResult.Err(
                    PceError(ErrorCode.UNSUPPORTED_ACTION, "Scroll needs a node target")
                )
            }
        }
    }

    private fun swipeAction(action: Action.Swipe): PceResult<BackendAction> {
        if (action.durationMs <= 0) {
            return PceResult.Err(PceError(ErrorCode.INVALID_ACTION, "Swipe duration must be positive"))
        }
        return PceResult.Ok(
            BackendAction.Swipe(action.from, action.to, action.durationMs)
        )
    }

    private fun launchAction(action: Action.Launch): PceResult<BackendAction> {
        if (action.packageName.isBlank()) {
            return PceResult.Err(PceError(ErrorCode.INVALID_ACTION, "Package name must not be blank"))
        }
        return PceResult.Ok(BackendAction.Launch(action.packageName, action.activityName))
    }

    private fun resolveTarget(snapshot: Snapshot, target: Target): PceResult<ResolvedTarget> =
        when (target) {
            is Target.Node -> snapshot.node(target.id)?.let {
                PceResult.Ok(ResolvedTarget.Node(it))
            } ?: PceResult.Err(
                PceError(
                    code = ErrorCode.NOT_FOUND,
                    message = "Node ${target.id} is not in snapshot ${snapshot.id}",
                    recovery = Recovery("resolve", "Resolve the node against this snapshot first"),
                )
            )
            is Target.BySelector -> resolver.resolve(snapshot, target.selector)
                .map { ResolvedTarget.Node(it.node) }
            is Target.Coordinates -> PceResult.Ok(ResolvedTarget.Coordinates(target.point))
        }

    private fun record(
        kind: TraceKind,
        started: Long? = null,
        snapshotId: SnapshotId? = null,
        action: Action? = null,
        selector: Selector? = null,
        nodeId: NodeId? = null,
        error: PceError? = null,
        message: String? = null,
    ) {
        val now = clock.nowMs()
        val event = TraceEvent(
            sequence = traceSequence.incrementAndGet(),
            atMs = now,
            kind = kind,
            snapshotId = snapshotId,
            action = action,
            selector = selector,
            nodeId = nodeId,
            backend = backend.id,
            durationMs = started?.let { now - it },
            error = error,
            message = message,
        )
        try {
            trace.record(event)
        } catch (_: Exception) {
            // Trace is diagnostic; it must never break an action.
        }
    }

    private fun capabilityError(capability: Capability): PceError? =
        if (capability in backend.capabilities) {
            null
        } else {
            PceError(
                code = ErrorCode.UNSUPPORTED_ACTION,
                message = "Backend ${backend.id} does not declare $capability",
            )
        }

    private sealed interface ResolvedTarget {
        data class Node(val node: com.phonecando.pce.api.Node) : ResolvedTarget
        data class Coordinates(val point: com.phonecando.pce.api.Point) : ResolvedTarget
    }

    companion object {
        fun create(
            backend: Backend,
            clock: Clock = Clock.System,
            idGenerator: IdGenerator = AtomicSnapshotIdGenerator(),
            resolver: Resolver = Resolver(),
            verifier: Verifier = Verifier(resolver),
        ): Pce = Pce(backend, clock, idGenerator, resolver, verifier, NoopTraceSink)

        /** Experimental factory for hosts that want a trace sink. */
        @ExperimentalPceApi
        fun createWithTrace(
            backend: Backend,
            trace: TraceSink,
            clock: Clock = Clock.System,
            idGenerator: IdGenerator = AtomicSnapshotIdGenerator(),
            resolver: Resolver = Resolver(),
            verifier: Verifier = Verifier(resolver),
        ): Pce = Pce(backend, clock, idGenerator, resolver, verifier, trace)
    }
}
