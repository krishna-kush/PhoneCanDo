package com.phonecando.runner.presence.glass.walls

import com.phonecando.runner.presence.glass.motion.Pt

// Where a card or a speech bubble goes: next to the mascot on the side
// toward the middle of the screen (off a side wall, below the top edge,
// above the bottom one), and never off the screen.
object Beside {
  /** The top-left of a [w] by [h] box beside the mascot covering [area] on [wall], [gap] pixels off it. */
  fun place(room: Room, area: Area, wall: Wall, w: Float, h: Float, gap: Float): Pt {
    val (x, y) = when (wall) {
      Wall.LEFT -> area.right + gap to area.top - h * 0.25f
      Wall.RIGHT -> area.left - gap - w to area.top - h * 0.25f
      Wall.TOP -> area.midX - w / 2 to area.bottom + gap
      Wall.BOTTOM -> area.midX - w / 2 to area.top - gap - h
    }
    val left = room.inLeft + gap
    val top = room.inTop + gap
    val right = maxOf(left, room.w - room.inRight - gap - w)
    val bottom = maxOf(top, room.h - room.inBottom - gap - h)
    return Pt(x.coerceIn(left, right), y.coerceIn(top, bottom))
  }
}
