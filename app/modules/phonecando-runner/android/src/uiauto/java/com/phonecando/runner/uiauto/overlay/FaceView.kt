package com.phonecando.runner.uiauto.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.view.View
import kotlin.math.min
import kotlin.random.Random

// A-01's face, small: the brand mark's red block on its amber one, offset
// down and right by theme/logo.json's shadow share, with two eyes in
// mascot/layout/eyes.ts's proportions that blink now and then.
internal class FaceView(context: Context, private val palette: Palette) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

  // 0 open, 1 shut.
  private var shut = 0f
  private var blinking: ValueAnimator? = null
  private val blink = Runnable { blink() }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    postDelayed(blink, nextBlinkMs())
  }

  override fun onDetachedFromWindow() {
    removeCallbacks(blink)
    blinking?.cancel()
    super.onDetachedFromWindow()
  }

  private fun blink() {
    blinking = ValueAnimator.ofFloat(0f, 1f, 0f).apply {
      duration = BLINK_MS
      addUpdateListener {
        shut = it.animatedValue as Float
        invalidate()
      }
      start()
    }
    postDelayed(blink, nextBlinkMs())
  }

  override fun onDraw(canvas: Canvas) {
    val side = min(width, height) / (1 + SHADOW)
    val off = side * SHADOW
    paint.color = palette.secondary
    canvas.drawRect(off, off, off + side, off + side, paint)
    paint.color = palette.primary
    canvas.drawRect(0f, 0f, side, side, paint)
    val eyeW = side * EYE_W
    val eyeH = side * EYE_H
    val open = eyeH * (1 - SHUT_SHARE * shut)
    val top = side * EYE_TOP + (eyeH - open)
    val left = side / 2 - side * EYE_GAP / 2 - eyeW
    val right = side / 2 + side * EYE_GAP / 2
    paint.color = palette.onPrimary
    canvas.drawRect(left, top, left + eyeW, top + open, paint)
    canvas.drawRect(right, top, right + eyeW, top + open, paint)
  }

  private fun nextBlinkMs() = 2_400L + Random.nextLong(2_400L)

  private companion object {
    // theme/logo.json shadow.ratio.
    const val SHADOW = 0.12f

    // mascot/layout/eyes.ts EYE.
    const val EYE_W = 0.25f
    const val EYE_H = 0.29f
    const val EYE_GAP = 0.08f
    const val EYE_TOP = 0.29f

    // How much of the eye a blink hides.
    const val SHUT_SHARE = 0.85f
    const val BLINK_MS = 180L
  }
}
