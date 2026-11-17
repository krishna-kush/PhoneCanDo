package com.phonecando.runner.uiauto.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.view.RoundedCorner
import android.view.View

// The screen's edge while an agent drives: a soft glow that breathes, or
// a thin steady line, following the display's rounded corners where
// Android tells them (12+). Its window never takes a touch.
internal class EdgeFrame(
  context: Context,
  private val palette: Palette,
  private val glow: Boolean,
) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val dp = resources.displayMetrics.density
  private val rect = RectF()
  private var breath = 1f
  private var breathing: ValueAnimator? = null

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (!glow) return
    breathing = ValueAnimator.ofFloat(LOW, 1f).apply {
      duration = BREATH_MS
      repeatMode = ValueAnimator.REVERSE
      repeatCount = ValueAnimator.INFINITE
      addUpdateListener {
        breath = it.animatedValue as Float
        invalidate()
      }
      start()
    }
  }

  override fun onDetachedFromWindow() {
    breathing?.cancel()
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    val corner = corner()
    if (glow) {
      for ((width, alpha) in GLOW) stroke(canvas, width * dp, corner, (alpha * breath).toInt())
    } else {
      stroke(canvas, LINE_DP * dp, corner, 255)
    }
  }

  private fun stroke(canvas: Canvas, width: Float, corner: Float, alpha: Int) {
    val inset = width / 2
    rect.set(inset, inset, this.width - inset, height - inset)
    paint.strokeWidth = width
    paint.color = Color.argb(alpha, Color.red(palette.primary), Color.green(palette.primary), Color.blue(palette.primary))
    val r = (corner - inset).coerceAtLeast(0f)
    canvas.drawRoundRect(rect, r, r, paint)
  }

  private fun corner(): Float {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return 0f
    return rootWindowInsets?.getRoundedCorner(RoundedCorner.POSITION_TOP_LEFT)?.radius?.toFloat() ?: 0f
  }

  private companion object {
    // Outer to inner: each stroke's width in dp and its alpha at full breath.
    val GLOW = listOf(18f to 26, 10f to 56, 5f to 120, 2f to 255)
    const val LINE_DP = 3f
    const val LOW = 0.45f
    const val BREATH_MS = 1_400L
  }
}
