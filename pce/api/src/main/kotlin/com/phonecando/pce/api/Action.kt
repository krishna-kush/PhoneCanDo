package com.phonecando.pce.api

/** A target resolved by the core before it reaches a backend. */
sealed interface Target {
    data class Node(val id: NodeId) : Target
    data class BySelector(val selector: Selector) : Target
    data class Coordinates(val point: Point) : Target
}

enum class ScrollDirection {
    UP,
    DOWN,
    LEFT,
    RIGHT,
}

enum class KeyCode {
    ENTER,
    BACK,
    HOME,
    RECENTS,
    TAB,
    ESCAPE,
    UP,
    DOWN,
    LEFT,
    RIGHT,
    DELETE,
}

/** High-level action requested by an AI or a flow. */
sealed interface Action {
    data class Tap(val target: Target) : Action
    data class LongPress(val target: Target, val durationMs: Long = 600) : Action
    data class TypeText(
        val text: String,
        val target: Target? = null,
        val clear: Boolean = false,
    ) : Action
    data class Key(val key: KeyCode) : Action
    data class Scroll(
        val direction: ScrollDirection,
        val target: Target? = null,
        val amount: Float = 0.5f,
    ) : Action
    data class Swipe(val from: Point, val to: Point, val durationMs: Long = 300) : Action
    data class Wait(val selector: Selector, val timeoutMs: Long = 5_000) : Action
    data class Assert(val selector: Selector) : Action
    data class Screenshot(val full: Boolean = false) : Action
    data class Launch(val packageName: String, val activityName: String? = null) : Action
}

/**
 * Backend-facing action after the core has resolved node ids. Backends must
 * reject actions that do not fit their declared [Capability] set.
 */
sealed interface BackendAction {
    data class Tap(
        val backendNodeId: BackendNodeId? = null,
        val point: Point? = null,
    ) : BackendAction

    data class LongPress(
        val backendNodeId: BackendNodeId? = null,
        val point: Point? = null,
        val durationMs: Long,
    ) : BackendAction

    data class SetText(
        val backendNodeId: BackendNodeId,
        val text: String,
        val clear: Boolean,
    ) : BackendAction

    data class Key(val key: KeyCode) : BackendAction

    data class Scroll(
        val backendNodeId: BackendNodeId? = null,
        val direction: ScrollDirection,
        val amount: Float,
    ) : BackendAction

    data class Swipe(
        val from: Point,
        val to: Point,
        val durationMs: Long,
    ) : BackendAction

    data class Launch(
        val packageName: String,
        val activityName: String? = null,
    ) : BackendAction

    data class Screenshot(val full: Boolean = false) : BackendAction
}
