package com.phonecando.runner.presence.glass.motion

import kotlin.math.abs
import kotlin.math.hypot

/** Which way a knock squashes it: against a side wall (across) or the top or bottom edge (down). */
enum class Axis { ACROSS, DOWN }

// The mascot's small moves, each a Tween of plain numbers: holding still,
// sliding along a wall, a hop, a flight and the wobble after it lands.
object Moves {
  /** How long a trip of [px] takes at [pxPerMs], kept between [min] and [max]. */
  fun msFor(px: Float, pxPerMs: Float, min: Long, max: Long): Long = (px / pxPerMs).toLong().coerceIn(min, max)

  fun still(pose: Pose, ms: Long = 0): Move = Tween(ms) { pose }

  /** Along a wall: eased both ends, stretched along the way it goes while it moves. */
  fun slide(from: Pose, to: Pose, ms: Long): Move = Tween(ms) { p ->
    val k = Ease.arch(p) * STRETCH
    val down = abs(to.y - from.y) > abs(to.x - from.x)
    val pose = Pose.mix(from, to, Ease.inOut(p))
    if (down) pose.squashed(1 - k * 0.6f, 1 + k) else pose.squashed(1 + k, 1 - k * 0.6f)
  }

  /** The springy squash after a knock, about its feet. */
  fun settle(pose: Pose, axis: Axis, strength: Float = 0.22f, ms: Long = SETTLE_MS): Move = Tween(ms) { p ->
    val w = Ease.wobble(p * ms, ms.toFloat(), strength)
    if (axis == Axis.ACROSS) pose.squashed(1 - w, 1 + w * 0.8f) else pose.squashed(1 + w * 0.8f, 1 - w)
  }

  /**
   * A hop from [from] to [to], [height] pixels high at its top, with a
   * crouch first and a squash on landing (Ease.hop). Up is away from the
   * edge it stands on: down the screen when it hangs from the top.
   */
  fun hop(from: Pose, to: Pose, height: Float, ms: Long): Move = Tween(ms) { p ->
    val s = Ease.hop(p)
    val q = Ease.inOut(Ease.span(p, 0.15f, 0.85f))
    val pose = Pose.mix(from, to, q)
    val up = if (abs(pose.rot) > 90f) -1f else 1f
    pose.copy(y = pose.y - up * height * s.lift).squashed(s.sx, s.sy)
  }

  /** Thrown or let go: fast at first and slowing, stretched by its speed, turning to how it lands. */
  fun fly(from: Pose, to: Pose, ms: Long): Move = Tween(ms) { p ->
    val k = (1 - p) * STRETCH * 1.6f
    val down = abs(to.y - from.y) > abs(to.x - from.x)
    val pose = Pose.mix(from, to, Ease.out(p))
    if (down) pose.squashed(1 - k * 0.5f, 1 + k) else pose.squashed(1 + k, 1 - k * 0.5f)
  }

  fun distance(a: Pose, b: Pose) = hypot(b.x - a.x, b.y - a.y)

  const val SETTLE_MS = 420L
  private const val STRETCH = 0.12f
}
