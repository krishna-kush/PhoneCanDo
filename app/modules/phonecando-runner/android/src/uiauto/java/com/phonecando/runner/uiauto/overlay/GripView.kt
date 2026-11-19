package com.phonecando.runner.uiauto.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import kotlin.math.abs

/** What a hand on the mascot did; places are the screen's, in pixels. */
internal interface GripHand {
  fun tap()

  fun drag(x: Float, y: Float)

  /** Let go at ([x], [y]) going ([vx], [vy]) pixels a second. */
  fun letGo(x: Float, y: Float, vx: Float, vy: Float)
}

// The one touchable spot of the mascot: a see-through window just over it
// where it rests. A tap, or a drag that follows your finger
// and a let-go that throws it. It draws nothing; the stage draws the
// mascot.
@SuppressLint("ViewConstructor")
internal class GripView(context: Context, private val hand: GripHand) : View(context) {
  private val slop = ViewConfiguration.get(context).scaledTouchSlop
  private var downX = 0f
  private var downY = 0f
  private var dragging = false
  private var pressed = false
  private var velocity: VelocityTracker? = null

  init {
    isClickable = true
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(e: MotionEvent): Boolean {
    when (e.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downX = e.rawX
        downY = e.rawY
        dragging = false
        pressed = true
        velocity?.recycle()
        velocity = VelocityTracker.obtain()
        track(e)
      }
      MotionEvent.ACTION_MOVE -> {
        track(e)
        if (!dragging && pressed && (abs(e.rawX - downX) > slop || abs(e.rawY - downY) > slop)) {
          dragging = true
        }
        if (dragging) hand.drag(e.rawX, e.rawY)
      }
      MotionEvent.ACTION_UP -> {
        track(e)
        if (dragging) {
          val v = velocity
          v?.computeCurrentVelocity(1000)
          hand.letGo(e.rawX, e.rawY, v?.xVelocity ?: 0f, v?.yVelocity ?: 0f)
        } else if (pressed) {
          performClick()
        }
        end()
      }
      MotionEvent.ACTION_CANCEL -> {
        if (dragging) hand.letGo(e.rawX, e.rawY, 0f, 0f)
        end()
      }
    }
    return true
  }

  override fun performClick(): Boolean {
    super.performClick()
    hand.tap()
    return true
  }

  // In the screen's places: the window moves under the finger while it drags.
  private fun track(e: MotionEvent) {
    val v = velocity ?: return
    val screen = MotionEvent.obtain(e)
    screen.setLocation(e.rawX, e.rawY)
    v.addMovement(screen)
    screen.recycle()
  }

  private fun end() {
    pressed = false
    dragging = false
    velocity?.recycle()
    velocity = null
  }

  override fun onDetachedFromWindow() {
    end()
    super.onDetachedFromWindow()
  }
}
