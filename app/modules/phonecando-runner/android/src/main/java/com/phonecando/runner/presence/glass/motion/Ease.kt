package com.phonecando.runner.presence.glass.motion

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.pow
import kotlin.math.sin

// Motion as plain functions of a share of time, as the site's backdrop has
// them (web/src/lib/backdrop/species/motion.ts): eases, an arch, and a hop's
// crouch, stretch and squash.
object Ease {
  fun clamp(v: Float, lo: Float = 0f, hi: Float = 1f) = v.coerceIn(lo, hi)

  fun mix(a: Float, b: Float, p: Float) = a + (b - a) * p

  /** p mapped onto [a, b] and held at its ends: a beat inside a move. */
  fun span(p: Float, a: Float, b: Float) = clamp((p - a) / (b - a))

  fun inOut(p: Float) = if (p < 0.5f) 2 * p * p else 1 - (-2 * p + 2).pow(2) / 2

  fun out(p: Float) = 1 - (1 - p).pow(3)

  fun into(p: Float) = p * p * p

  /** Up and back down: 0 at both ends, 1 in the middle. */
  fun arch(p: Float) = sin(PI * clamp(p)).toFloat()

  /** One hop over p 0 to 1, as motion.ts jump(): a crouch, a stretched flight, a squashed landing. */
  fun hop(p: Float): Squash {
    if (p <= 0f || p >= 1f) return Squash.STILL
    if (p < 0.15f) {
      val k = arch(p / 0.15f / 2)
      return Squash(0f, 1 + 0.16f * k, 1 - 0.16f * k)
    }
    if (p < 0.85f) {
      val q = (p - 0.15f) / 0.7f
      return Squash(arch(q), 1 - 0.1f * (1 - q), 1 + 0.14f * (1 - q))
    }
    val k = arch((p - 0.85f) / 0.15f)
    return Squash(0f, 1 + 0.2f * k, 1 - 0.2f * k)
  }

  /** A spring settling after a knock: [strength] at once, gone in about [ms]. */
  fun wobble(t: Float, ms: Float, strength: Float): Float {
    if (t <= 0f || t >= ms) return 0f
    val p = t / ms
    return (strength * exp(-4.5 * p) * cos(2 * PI * p * 2.2)).toFloat()
  }
}

/** A share of a hop's height off the ground ([lift], 0 to 1) and its squash and stretch. */
data class Squash(val lift: Float, val sx: Float, val sy: Float) {
  companion object {
    val STILL = Squash(0f, 1f, 1f)
  }
}
