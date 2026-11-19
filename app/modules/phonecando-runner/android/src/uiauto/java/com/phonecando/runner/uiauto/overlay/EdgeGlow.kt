package com.phonecando.runner.uiauto.overlay

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF

// The screen's edge lit: a soft glow following the display's rounded
// corners, red while an agent drives and amber while it watches you. The
// stage gives its brightness each frame, so it breathes.
internal class EdgeGlow(private val dp: Float) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val rect = RectF()

  fun draw(canvas: Canvas, width: Int, height: Int, color: Int, breath: Float, corner: Float) {
    for ((w, alpha) in LAYERS) {
      val stroke = w * dp
      val inset = stroke / 2
      rect.set(inset, inset, width - inset, height - inset)
      paint.strokeWidth = stroke
      paint.color = Color.argb((alpha * breath).toInt(), Color.red(color), Color.green(color), Color.blue(color))
      val r = (corner - inset).coerceAtLeast(0f)
      canvas.drawRoundRect(rect, r, r, paint)
    }
  }

  private companion object {
    // Outer to inner: each stroke's width in dp and its alpha at full breath.
    val LAYERS = listOf(18f to 26, 10f to 56, 5f to 120, 2f to 255)
  }
}
