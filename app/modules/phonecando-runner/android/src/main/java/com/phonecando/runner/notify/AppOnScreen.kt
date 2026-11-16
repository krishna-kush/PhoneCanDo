package com.phonecando.runner.notify

import java.util.concurrent.CopyOnWriteArrayList

// Whether PhoneCanDo's activity is resumed, as the module hears it
// (OnActivityEntersForeground/Background), and who hears it change. Unlike
// AppForeground's process importance it turns false at the pause itself,
// while Android still lets the service take the foreground again, so the
// service's notification can drop its "ready" line while you are in the
// app and bring it back as you leave.
internal object AppOnScreen {
  fun interface Listener {
    fun onChange(shown: Boolean)
  }

  @Volatile
  var shown = false
    private set

  private val listeners = CopyOnWriteArrayList<Listener>()

  fun set(shown: Boolean) {
    if (this.shown == shown) return
    this.shown = shown
    listeners.forEach { it.onChange(shown) }
  }

  fun addListener(listener: Listener) {
    listeners += listener
  }

  fun removeListener(listener: Listener) {
    listeners -= listener
  }
}
