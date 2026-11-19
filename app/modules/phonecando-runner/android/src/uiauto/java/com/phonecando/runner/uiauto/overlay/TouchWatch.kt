package com.phonecando.runner.uiauto.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.view.MotionEvent
import android.view.View

// A one-pixel, see-through window that never takes a touch of its own but
// hears of every touch anywhere else on the screen (FLAG_WATCH_OUTSIDE_TOUCH:
// ACTION_OUTSIDE), yours or the agent's. GlassOverlay tells them apart: the
// agent's land while the glass lets touches through, when this window is
// not touchable and so hears nothing. [touched] gets where it landed in
// the screen's pixels, or (0, 0) when Android hides it (a touch on another
// app's window).
@SuppressLint("ViewConstructor")
internal class TouchWatch(context: Context, private val touched: (x: Float, y: Float) -> Unit) : View(context) {
  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(e: MotionEvent): Boolean {
    if (e.actionMasked == MotionEvent.ACTION_OUTSIDE) touched(e.rawX, e.rawY)
    return false
  }
}
