package com.phonecando.pce.api

import kotlin.math.hypot

/** Screen point in physical pixels. */
data class Point(val x: Int, val y: Int) {
    fun distanceTo(other: Point): Double = hypot((x - other.x).toDouble(), (y - other.y).toDouble())
}

/**
 * Screen rectangle in physical pixels. Android accessibility bounds are
 * left/top/right/bottom with right/bottom exclusive; the PCE keeps that
 * convention and never assumes a display size.
 */
data class Bounds(
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
) {
    val width: Int get() = right - left
    val height: Int get() = bottom - top
    val center: Point get() = Point((left + right) / 2, (top + bottom) / 2)
    val isValid: Boolean get() = right >= left && bottom >= top

    fun contains(point: Point): Boolean =
        point.x in left until right && point.y in top until bottom
}
