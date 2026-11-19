package com.phonecando.runner.uiauto.overlay

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.drawable.Drawable

// The card's back: the app's card (square panel, a red edge, a hard amber
// shadow 2 dp down and right) as a comic speech box, its tail pointing at
// the mascot from the side it stands on. The box sits [margin] in from
// every side, so the tail has room wherever it points and the card's size
// never depends on where it is.
internal class CardBack(private val palette: Palette, dp: Float) : Drawable() {
  enum class Side { LEFT, RIGHT, TOP, BOTTOM }

  /** Where the tail is: the side it pokes out of, and how far along that side (px from the card's own edge). */
  var tail: Pair<Side, Float>? = null
    set(value) {
      field = value
      invalidateSelf()
    }

  val margin = TAIL_DP * dp
  private val shadow = SHADOW_DP * dp
  private val edgeW = dp
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
  private val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = edgeW
    strokeJoin = Paint.Join.MITER
  }
  private val box = RectF()
  private val path = Path()

  override fun draw(canvas: Canvas) {
    val b = bounds
    box.set(b.left + margin, b.top + margin, b.right - margin - shadow, b.bottom - margin - shadow)
    shape(box)
    // The shadow: the same shape, down and right.
    canvas.save()
    canvas.translate(shadow, shadow)
    fill.color = palette.secondary
    canvas.drawPath(path, fill)
    canvas.restore()
    fill.color = palette.panel
    canvas.drawPath(path, fill)
    edge.color = palette.primary
    canvas.drawPath(path, edge)
  }

  // The box and its tail as one outline, so the edge runs round both.
  private fun shape(r: RectF) {
    path.reset()
    val t = tail
    val half = margin * 0.9f
    if (t == null) {
      path.addRect(r, Path.Direction.CW)
      return
    }
    val (side, along) = t
    path.moveTo(r.left, r.top)
    if (side == Side.TOP) notch(r.top, r.left, r.right, along, half, -margin, horizontal = true)
    path.lineTo(r.right, r.top)
    if (side == Side.RIGHT) notch(r.right, r.top, r.bottom, along, half, margin, horizontal = false)
    path.lineTo(r.right, r.bottom)
    if (side == Side.BOTTOM) notchBack(r.bottom, r.right, r.left, along, half, margin, horizontal = true)
    path.lineTo(r.left, r.bottom)
    if (side == Side.LEFT) notchBack(r.left, r.bottom, r.top, along, half, -margin, horizontal = false)
    path.close()
  }

  // A tail on an edge walked forward (left to right, or top to bottom).
  private fun notch(fixed: Float, from: Float, to: Float, along: Float, half: Float, out: Float, horizontal: Boolean) {
    val c = clamp(along, from + half * 2, to - half * 2)
    point(horizontal, c - half, fixed)
    point(horizontal, c, fixed + out)
    point(horizontal, c + half, fixed)
  }

  // The same on an edge walked backward (right to left, or bottom to top).
  private fun notchBack(fixed: Float, from: Float, to: Float, along: Float, half: Float, out: Float, horizontal: Boolean) {
    val c = clamp(along, to + half * 2, from - half * 2)
    point(horizontal, c + half, fixed)
    point(horizontal, c, fixed + out)
    point(horizontal, c - half, fixed)
  }

  // Along the edge, kept off its corners; the middle when the edge is too short for that.
  private fun clamp(v: Float, lo: Float, hi: Float) = if (lo > hi) (lo + hi) / 2 else v.coerceIn(lo, hi)

  private fun point(horizontal: Boolean, along: Float, across: Float) {
    if (horizontal) path.lineTo(along, across) else path.lineTo(across, along)
  }

  override fun setAlpha(alpha: Int) = Unit

  override fun setColorFilter(colorFilter: ColorFilter?) = Unit

  @Deprecated("Deprecated in Java")
  override fun getOpacity(): Int = PixelFormat.TRANSLUCENT

  private companion object {
    const val TAIL_DP = 9f
    const val SHADOW_DP = 2f
  }
}
