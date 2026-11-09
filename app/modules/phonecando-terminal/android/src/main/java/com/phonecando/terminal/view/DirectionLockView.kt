package com.phonecando.terminal.view

import android.content.Context
import android.view.MotionEvent
import android.view.ViewConfiguration
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs

// Hosts a terminal: a gesture that starts on it stays the terminal's while
// it moves mostly up or down (its scrollback, the program's wheel), and is
// its parents' (the tab pager) when it moves mostly sideways first. On the
// first contact it asks every parent not to intercept; past the touch slop
// it keeps that for a vertical move and gives it back for a sideways one,
// so the pager takes the swipe from there with its own finger-following
// drag. Android clears the request at every new gesture.
class DirectionLockView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val slop = ViewConfiguration.get(context).scaledTouchSlop
  private var downX = 0f
  private var downY = 0f
  private var decided = false

  override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
    when (ev.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downX = ev.x
        downY = ev.y
        decided = false
        parent?.requestDisallowInterceptTouchEvent(true)
      }
      MotionEvent.ACTION_MOVE -> if (!decided) {
        val dx = abs(ev.x - downX)
        val dy = abs(ev.y - downY)
        if (dx > slop || dy > slop) {
          decided = true
          if (dx > dy) parent?.requestDisallowInterceptTouchEvent(false)
        }
      }
    }
    return super.dispatchTouchEvent(ev)
  }
}
