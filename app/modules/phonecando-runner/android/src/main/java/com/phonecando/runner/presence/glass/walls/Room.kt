package com.phonecando.runner.presence.glass.walls

import com.phonecando.runner.presence.glass.motion.Axis
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt

/** The screen's four edges the mascot lives on. */
enum class Wall {
  LEFT,
  RIGHT,
  TOP,
  BOTTOM;

  val side: Boolean get() = this == LEFT || this == RIGHT

  /** Which way a landing on it squashes the mascot. */
  val knock: Axis get() = if (side) Axis.ACROSS else Axis.DOWN
}

/**
 * Where it sticks: a wall and how far along it. On a side wall [along] is
 * its feet's y; on the top or bottom edge, its middle's x. Pixels.
 */
data class Perch(val wall: Wall, val along: Float)

/** The mascot's box upright, in pixels, its feet at its bottom middle, and the [gap] it keeps from an edge. */
data class Body(val w: Float, val h: Float, val gap: Float)

/** A box on the screen, in pixels. */
data class Area(val left: Float, val top: Float, val right: Float, val bottom: Float) {
  val midX: Float get() = (left + right) / 2
  val midY: Float get() = (top + bottom) / 2

  fun contains(p: Pt, pad: Float = 0f) = p.x >= left - pad && p.x <= right + pad && p.y >= top - pad && p.y <= bottom + pad
}

/**
 * The screen as the mascot knows it: [w] by [h] pixels, and the bars and
 * cutouts it stays inside of ([inLeft], [inTop], [inRight], [inBottom]).
 */
data class Room(
  val w: Float,
  val h: Float,
  val inLeft: Float = 0f,
  val inTop: Float = 0f,
  val inRight: Float = 0f,
  val inBottom: Float = 0f,
) {
  /** Standing on [perch]: side on a side wall, its back to it and facing in; hanging from the top edge; standing on the bottom one. */
  fun pose(perch: Perch, body: Body): Pose {
    val along = clampAlong(perch, body)
    return when (perch.wall) {
      Wall.LEFT -> Pose(inLeft + body.gap + body.w / 2, along, toward = 1)
      Wall.RIGHT -> Pose(w - inRight - body.gap - body.w / 2, along, toward = -1)
      Wall.BOTTOM -> Pose(along, h - inBottom - body.gap, toward = inward(along))
      Wall.TOP -> Pose(along, inTop + body.gap, rot = 180f, toward = inward(along))
    }
  }

  /** [perch] moved along its wall as far as the mascot fits. */
  fun clamp(perch: Perch, body: Body) = perch.copy(along = clampAlong(perch, body))

  fun range(wall: Wall, body: Body): ClosedFloatingPointRange<Float> = if (wall.side) {
    val lo = inTop + body.gap + body.h
    val hi = h - inBottom - body.gap
    lo..maxOf(lo, hi)
  } else {
    val lo = inLeft + body.gap + body.w / 2
    val hi = w - inRight - body.gap - body.w / 2
    lo..maxOf(lo, hi)
  }

  /** The screen its body covers at [pose]: below its feet when it hangs from the top edge. */
  fun area(pose: Pose, body: Body): Area {
    val hw = body.w * pose.sx / 2
    val bh = body.h * pose.sy
    return if (hanging(pose)) Area(pose.x - hw, pose.y, pose.x + hw, pose.y + bh) else Area(pose.x - hw, pose.y - bh, pose.x + hw, pose.y)
  }

  /** The wall nearest [p], and how far along it [p] is. */
  fun nearest(p: Pt, body: Body): Perch {
    val gaps = mapOf(
      Wall.LEFT to p.x - inLeft,
      Wall.RIGHT to w - inRight - p.x,
      Wall.TOP to p.y - inTop,
      Wall.BOTTOM to h - inBottom - p.y,
    )
    val wall = gaps.minBy { it.value }.key
    return clamp(Perch(wall, along(wall, p, body)), body)
  }

  /** How far along [wall] a perch level with [p] is: its middle level with p. */
  fun along(wall: Wall, p: Pt, body: Body): Float = if (wall.side) p.y + body.h / 2 else p.x

  /** The same height on the nearer side wall: where an entrance heads for when it was last on the top or bottom edge. */
  fun toSide(perch: Perch, body: Body): Perch {
    if (perch.wall.side) return clamp(perch, body)
    val wall = if (perch.along < w / 2) Wall.LEFT else Wall.RIGHT
    val along = if (perch.wall == Wall.TOP) range(wall, body).start else range(wall, body).endInclusive
    return Perch(wall, along)
  }

  /** The bottom corner nearer [pose]: where it goes to sleep. */
  fun corner(pose: Pose, body: Body): Perch {
    val r = range(Wall.BOTTOM, body)
    return Perch(Wall.BOTTOM, if (pose.x < w / 2) r.start else r.endInclusive)
  }

  /** Where it stands on its first entrance: the right wall, a little below the middle. */
  fun home(body: Body) = clamp(Perch(Wall.RIGHT, h * 0.62f), body)

  private fun clampAlong(perch: Perch, body: Body) = perch.along.coerceIn(range(perch.wall, body))

  private fun inward(x: Float) = if (x < w / 2) 1 else -1

  companion object {
    fun hanging(pose: Pose) = pose.rot > 90f || pose.rot < -90f
  }
}
