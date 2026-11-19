package com.phonecando.runner.presence.glass.walls

import com.phonecando.runner.presence.glass.motion.Pt
import kotlin.math.abs

// Where the mascot goes as the agent touches the screen: along its wall
// to stay level with the spot, as if it watched its own hand, and never
// over it. When the spot would be under it, it stops short of it or goes
// past it, whichever is nearer; failing both, the other wall. The touch
// lands either way (the glass lets it through), so this is only so you see
// what the agent touched.
object Dodge {
  /** Where to stand for a touch along [path] (a tap's point, or a swipe's two ends), from [perch]. */
  fun follow(room: Room, body: Body, perch: Perch, path: List<Pt>): Perch {
    if (path.isEmpty()) return perch
    val points = sample(path)
    val aim = path.first()
    for (wall in listOf(perch.wall, opposite(perch.wall))) {
      val want = room.clamp(Perch(wall, room.along(wall, aim, body)), body)
      clearOn(room, body, want, points)?.let { return it }
    }
    return room.clamp(Perch(perch.wall, room.along(perch.wall, aim, body)), body)
  }

  /** Whether a touch along [path] would land under it at [perch]. */
  fun under(room: Room, body: Body, perch: Perch, path: List<Pt>): Boolean = !clear(room, body, perch, sample(path))

  private fun clearOn(room: Room, body: Body, want: Perch, points: List<Pt>): Perch? {
    if (clear(room, body, want, points)) return want
    // Just past the pad, so the spot is clear of it, not on its edge.
    val pad = pad(body) + 1f
    val range = room.range(want.wall, body)
    val tries = points.flatMap { p ->
      if (want.wall.side) {
        listOf(p.y - pad, p.y + pad + body.h)
      } else {
        listOf(p.x - pad - body.w / 2, p.x + pad + body.w / 2)
      }
    }
    return tries
      .filter { it in range }
      .sortedBy { abs(it - want.along) }
      .map { Perch(want.wall, it) }
      .firstOrNull { clear(room, body, it, points) }
  }

  private fun clear(room: Room, body: Body, perch: Perch, points: List<Pt>): Boolean {
    val area = room.area(room.pose(perch, body), body)
    val pad = pad(body)
    return points.none { area.contains(it, pad) }
  }

  // A swipe's line, as points close enough together that none slips past the body.
  private fun sample(path: List<Pt>): List<Pt> {
    if (path.size < 2) return path
    return path.zipWithNext().flatMap { (a, b) -> (0..STEPS).map { i -> Pt(a.x + (b.x - a.x) * i / STEPS, a.y + (b.y - a.y) * i / STEPS) } }
  }

  private fun pad(body: Body) = body.w * PAD

  fun opposite(wall: Wall) = when (wall) {
    Wall.LEFT -> Wall.RIGHT
    Wall.RIGHT -> Wall.LEFT
    Wall.TOP -> Wall.BOTTOM
    Wall.BOTTOM -> Wall.TOP
  }

  private const val STEPS = 12
  private const val PAD = 0.25f
}
