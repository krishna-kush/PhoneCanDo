package com.phonecando.pce.core

import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.Node
import com.phonecando.pce.api.NodeFlag
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.ResolvedNode
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot

/**
 * Resolves one selector against one snapshot. Multiple matches are never
 * silently ranked: callers get [ErrorCode.AMBIGUOUS] and must add `index` or a
 * more specific selector. This keeps automation deterministic.
 */
class Resolver {
    fun resolve(snapshot: Snapshot, selector: Selector): PceResult<ResolvedNode> {
        if (!selector.isValid) {
            return PceResult.Err(
                PceError(
                    code = ErrorCode.INVALID_SELECTOR,
                    message = "Selector is empty, has a negative index, or has contradictory flags",
                )
            )
        }

        val candidates = snapshot.nodes.filter { matches(snapshot, it, selector) }
        if (candidates.isEmpty()) {
            return PceResult.Err(
                PceError(
                    code = ErrorCode.NOT_FOUND,
                    message = "No node matched the selector",
                    recovery = Recovery("observe", "Re-observe and try a different selector"),
                )
            )
        }

        val index = selector.index
        if (index != null) {
            val node = candidates.getOrNull(index)
                ?: return PceResult.Err(
                    PceError(
                        code = ErrorCode.NOT_FOUND,
                        message = "Selector matched ${candidates.size} nodes; index $index is out of range",
                        recovery = Recovery("resolve", "Use an index in 0 until ${candidates.size}"),
                    )
                )
            return PceResult.Ok(ResolvedNode(snapshot.id, node, score(node, selector)))
        }

        if (candidates.size > 1) {
            return PceResult.Err(
                PceError(
                    code = ErrorCode.AMBIGUOUS,
                    message = "Selector matched ${candidates.size} nodes",
                    recovery = Recovery("resolve", "Add index or a more specific selector"),
                    candidates = candidates.map { it.id },
                )
            )
        }

        val node = candidates.single()
        return PceResult.Ok(ResolvedNode(snapshot.id, node, score(node, selector)))
    }

    private fun matches(snapshot: Snapshot, node: Node, selector: Selector): Boolean {
        if (selector.viewId != null && node.viewId != selector.viewId) return false
        if (selector.text != null && node.text != selector.text) return false
        val textContains = selector.textContains
        if (textContains != null &&
            node.text?.contains(textContains, ignoreCase = true) != true
        ) {
            return false
        }
        if (selector.contentDescription != null && node.contentDescription != selector.contentDescription) return false
        if (selector.className != null && node.className != selector.className) return false
        if (selector.packageName != null && node.packageName != selector.packageName) return false
        if (!node.flags.containsAll(selector.requiredFlags)) return false
        if (node.flags.any { it in selector.forbiddenFlags }) return false

        selector.near?.let { near ->
            if (node.bounds.center.distanceTo(near.point) > near.radius) return false
        }

        selector.parent?.let { parentSelector ->
            val parent = node.parentId?.let { snapshot.node(it) } ?: return false
            if (!matches(snapshot, parent, parentSelector)) return false
        }

        return true
    }

    private fun score(node: Node, selector: Selector): Int {
        var score = 0
        if (selector.viewId != null) score += 100
        if (selector.text != null) score += 60
        if (selector.contentDescription != null) score += 50
        if (selector.textContains != null) score += 30
        if (selector.className != null) score += 10
        if (selector.packageName != null) score += 5
        if (selector.parent != null) score += 15
        if (selector.near != null) score += 10
        score += selector.requiredFlags.size * 2
        if (node.has(NodeFlag.VISIBLE)) score += 5
        if (node.has(NodeFlag.CLICKABLE)) score += 3
        if (node.has(NodeFlag.ENABLED)) score += 2
        return score
    }
}
