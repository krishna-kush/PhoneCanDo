package com.phonecando.runner.presence.glass.motion

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.sin

// What the mascot does while it stays put, as plain functions of the
// time it has been on the glass, so the stage keeps no timers: blinks,
// eyes that wander or follow a point, breathing, the thinking dots and
// the z's of its sleep.
object Idle {
  /** How shut its lids are for a blink now, 0 open to 1 shut: one quick blink every few seconds, never on a beat. */
  fun blink(t: Long, seed: Int = 0): Float {
    if (t < 0) return 0f
    // One blink somewhere in each stretch of BLINK_EVERY, never in its first quarter.
    val n = t / BLINK_EVERY
    val room = BLINK_EVERY * 3 / 4 - BLINK_MS
    val at = BLINK_EVERY / 4 + (noise(seed * 31 + n.toInt()) * room).toLong()
    val into = t % BLINK_EVERY - at
    return if (into in 0 until BLINK_MS) Ease.arch(into.toFloat() / BLINK_MS) else 0f
  }

  /** Where its eyes wander when nothing calls them, -1 to 1 each way: slow, and mostly about the middle. */
  fun wander(t: Long, seed: Int = 0): Pt {
    val s = t / 1000f + seed
    return Pt((0.55f * sin(s * 0.7f) + 0.25f * sin(s * 1.9f + 1f)), (0.35f * sin(s * 0.5f + 2f)))
  }

  /** Its pupils turned toward [target] from [from], -1 to 1 each way. */
  fun lookAt(from: Pt, target: Pt, reach: Float): Pt {
    val dx = target.x - from.x
    val dy = target.y - from.y
    val d = hypot(dx, dy).coerceAtLeast(1f)
    val k = (d / reach).coerceAtMost(1f)
    return Pt(dx / d * k, dy / d * k)
  }

  /** Breathing: a slow squash that never quite stops; deeper and slower asleep. */
  fun breathe(t: Long, asleep: Boolean): Pair<Float, Float> {
    val period = if (asleep) 3_200f else 2_200f
    val k = sin(t / period * 2 * PI).toFloat() * (if (asleep) 0.05f else 0.025f)
    return (1 - k * 0.6f) to (1 + k)
  }

  /** The z's rising off it asleep: for each, how far up it has gone (0 to 1) and how big it is (0 to 1). */
  fun zs(t: Long): List<Pair<Float, Float>> = (0..2).map { i ->
    val p = ((t + i * Z_MS / 3) % Z_MS).toFloat() / Z_MS
    p to (0.5f + 0.5f * p)
  }

  /** How bright the edge's glow is breathing, LOW to 1. */
  fun glow(t: Long): Float = GLOW_LOW + (1 - GLOW_LOW) * (0.5f + 0.5f * sin(t / GLOW_MS * 2 * PI).toFloat())

  // A steady pseudo-random 0 to 1 for n, so a blink's timing never repeats a beat.
  private fun noise(n: Int): Float {
    val v = sin(n * 12.9898 + 78.233) * 43_758.545
    return abs((v - v.toLong()).toFloat())
  }

  private const val BLINK_EVERY = 4_000L
  private const val BLINK_MS = 160L
  private const val Z_MS = 2_400L
  private const val GLOW_LOW = 0.45f
  private const val GLOW_MS = 2_800f
}
