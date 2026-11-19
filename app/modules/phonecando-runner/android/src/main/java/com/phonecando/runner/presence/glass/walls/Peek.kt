package com.phonecando.runner.presence.glass.walls

import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing
import com.phonecando.runner.presence.glass.motion.Ease
import com.phonecando.runner.presence.glass.motion.Move
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.motion.Tween

/**
 * Peeking round the edge of the screen by a side wall's spot [spot]: its
 * feet stay out past the edge and it leans in round it, so only the top
 * corner of its head, with its eye, shows, as someone leans round a door
 * frame. The way in (Entrance) and out (Exit) share it.
 */
internal class Peek(room: Room, private val body: Body, private val spot: Pose) {
  /** The way out of the screen past its wall's edge: 1 right, -1 left. It faces the other way, in. */
  val out = -spot.toward

  private val edge = if (out > 0) room.w else 0f

  /** Looking straight into the screen, level. */
  val ahead = Pt(spot.toward.toFloat(), 0f)

  /** Its feet [behind] body widths out past the edge, leaning [lean] degrees in round it; side on, eyes open. */
  fun at(behind: Float, lean: Float, gaze: Pt = ahead): Pose =
    spot.copy(x = edge + out * body.w * behind, rot = spot.toward * lean, facing = Facing.SIDE, eyes = Eyes.DOT, gaze = gaze, shut = 0f)

  /** Wholly behind the edge, upright. */
  val hidden: Pose get() = at(HIDDEN, 0f)

  /**
   * A hop between [from] and [to] [height] pixels high (Ease.hop's crouch,
   * flight and squash), straightening up from a lean, or leaning into one,
   * over the share [turn] of its time, its eyes on [gaze] all the way.
   */
  fun hop(from: Pose, to: Pose, height: Float, ms: Long, turn: ClosedFloatingPointRange<Float>, gaze: Pt = ahead): Move = Tween(ms) { p ->
    val s = Ease.hop(p)
    val q = Ease.inOut(Ease.span(p, 0.15f, 0.85f))
    val k = Ease.inOut(Ease.span(p, turn.start, turn.endInclusive))
    Pose.mix(from, to, q).copy(
      y = Ease.mix(from.y, to.y, q) - height * s.lift,
      rot = Ease.mix(from.rot, to.rot, k),
      facing = Facing.SIDE,
      eyes = Eyes.DOT,
      gaze = gaze,
      shut = 0f,
    ).squashed(s.sx, s.sy)
  }

  companion object {
    // Feet this many body widths out: nothing of it shows upright.
    const val HIDDEN = 0.58f
  }
}
