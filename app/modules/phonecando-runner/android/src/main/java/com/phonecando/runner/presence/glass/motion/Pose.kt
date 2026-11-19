package com.phonecando.runner.presence.glass.motion

import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** A point on the screen, in pixels. */
data class Pt(val x: Float, val y: Float)

/**
 * Where the mascot is at one moment, in screen pixels: its feet ([x], [y]),
 * turned [rot] degrees about them (clockwise; 180 hangs it from the top
 * edge), squashed or stretched by [sx] and [sy] about them, facing [toward]
 * on screen (-1 left, 1 right) when side on, and hanging from a line tied
 * at [thread] when it has one.
 *
 * A move that acts with its face (a peek: eyes darting, a blink, a turn to
 * you) also says how it looks: [facing] and [eyes] over the look the stage
 * plays the move with, its pupils' [gaze] (-1 to 1 each way, screen
 * directions) and how [shut] its lids are (0 open to 1 shut). Each left
 * null leaves that to the stage: the move's look, wandering eyes, blinks.
 */
data class Pose(
  val x: Float,
  val y: Float,
  val rot: Float = 0f,
  val sx: Float = 1f,
  val sy: Float = 1f,
  val toward: Int = 1,
  val thread: Pt? = null,
  val facing: Facing? = null,
  val eyes: Eyes? = null,
  val gaze: Pt? = null,
  val shut: Float? = null,
) {
  /** The top of its body, [height] pixels up from its feet as it is turned: where a line ties on. */
  fun crown(height: Float): Pt {
    val a = rot * PI.toFloat() / 180
    return Pt(x + height * sy * sin(a), y - height * sy * cos(a))
  }

  fun squashed(sx: Float, sy: Float) = copy(sx = this.sx * sx, sy = this.sy * sy)

  companion object {
    /**
     * Between [a] and [b] by [p]; the way it faces, its line and its look
     * come from [b] once past halfway, but a gaze or lids both ends give
     * move between them.
     */
    fun mix(a: Pose, b: Pose, p: Float): Pose = Pose(
      x = Ease.mix(a.x, b.x, p),
      y = Ease.mix(a.y, b.y, p),
      rot = Ease.mix(a.rot, b.rot, p),
      sx = Ease.mix(a.sx, b.sx, p),
      sy = Ease.mix(a.sy, b.sy, p),
      toward = if (p < 0.5f) a.toward else b.toward,
      thread = if (p < 0.5f) a.thread else b.thread,
      facing = if (p < 0.5f) a.facing else b.facing,
      eyes = if (p < 0.5f) a.eyes else b.eyes,
      gaze = between(a.gaze, b.gaze, p) { x, y -> Pt(Ease.mix(x.x, y.x, p), Ease.mix(x.y, y.y, p)) },
      shut = between(a.shut, b.shut, p) { x, y -> Ease.mix(x, y, p) },
    )

    private fun <T : Any> between(a: T?, b: T?, p: Float, mix: (T, T) -> T): T? =
      if (a != null && b != null) mix(a, b) else if (p < 0.5f) a else b
  }
}
