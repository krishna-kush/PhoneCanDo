package com.phonecando.pce.api

/** Proximity filter relative to a screen point, in physical pixels. */
data class Near(val point: Point, val radius: Int) {
    val isValid: Boolean get() = radius > 0
}

/**
 * Declarative node selector. Every non-null field is an AND condition.
 * `index` only disambiguates an already constrained match; it is not a
 * selector on its own.
 */
data class Selector(
    val viewId: String? = null,
    val text: String? = null,
    val textContains: String? = null,
    val contentDescription: String? = null,
    val className: String? = null,
    val packageName: String? = null,
    val index: Int? = null,
    val parent: Selector? = null,
    val near: Near? = null,
    val requiredFlags: Set<NodeFlag> = emptySet(),
    val forbiddenFlags: Set<NodeFlag> = emptySet(),
) {
    val hasCriteria: Boolean
        get() = viewId != null ||
            text != null ||
            textContains != null ||
            contentDescription != null ||
            className != null ||
            packageName != null ||
            parent != null ||
            near != null ||
            requiredFlags.isNotEmpty() ||
            forbiddenFlags.isNotEmpty()

    val isValid: Boolean
        get() = hasCriteria &&
            (index == null || index >= 0) &&
            requiredFlags.intersect(forbiddenFlags).isEmpty() &&
            (near == null || near.isValid) &&
            (parent == null || parent.isValid)
}
