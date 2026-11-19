package com.phonecando.runner.presence.glass.motion

/** A move of the mascot's: where it is [t] milliseconds in, for [ms] milliseconds; after that it stays at [end]. */
interface Move {
  val ms: Long

  fun at(t: Long): Pose

  val end: Pose get() = at(ms)
}

/** A move drawn from a share of its time, 0 to 1. */
class Tween(override val ms: Long, private val pose: (Float) -> Pose) : Move {
  override fun at(t: Long): Pose = pose(if (ms <= 0) 1f else Ease.clamp(t.toFloat() / ms))
}

/** Moves one after another. */
class Chain(private val parts: List<Move>) : Move {
  init {
    require(parts.isNotEmpty())
  }

  override val ms: Long = parts.sumOf { it.ms }

  override fun at(t: Long): Pose {
    var left = t
    for (part in parts) {
      if (left <= part.ms) return part.at(left.coerceAtLeast(0))
      left -= part.ms
    }
    return parts.last().end
  }

  companion object {
    fun of(vararg parts: Move): Move = if (parts.size == 1) parts[0] else Chain(parts.toList())
  }
}
