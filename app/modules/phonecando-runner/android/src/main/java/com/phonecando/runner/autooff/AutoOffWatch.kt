package com.phonecando.runner.autooff

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.notify.AppForeground
import com.phonecando.runner.presence.Presence

// Runs while the accessibility service is connected: every TICK_MS it
// reads the facts AutoOffRules weighs (Auto off's switch first, so with it
// off nothing else is asked) and, when the rule says so, marks Auto off as
// the cause and calls `turnOff` (the service's disableSelf). On the main
// thread, from the service's connect to its destroy.
class AutoOffWatch(private val context: Context, private val turnOff: () -> Unit) {
  private val handler = Handler(Looper.getMainLooper())
  private val connectedAt = SystemClock.elapsedRealtime()
  private var quietSince: Long? = null
  private var stopped = false

  private val tick = object : Runnable {
    override fun run() {
      if (stopped) return
      if (look()) return
      handler.postDelayed(this, AutoOffRules.TICK_MS)
    }
  }

  fun start() {
    AutoOff.clearTurnedOff(context)
    handler.postDelayed(tick, AutoOffRules.TICK_MS)
  }

  fun stop() {
    stopped = true
    handler.removeCallbacks(tick)
  }

  // True once it turned the service off.
  private fun look(): Boolean {
    val on = AutoOff.isOn(context)
    val facts = AutoOffRules.Facts(
      on = on,
      appInFront = on && AppForeground.isForeground(context),
      screenWanted = on && (Bridge.screenWanted() || Presence.store.handOver() != null),
      connectedAt = connectedAt,
    )
    val step = AutoOffRules.step(facts, quietSince, SystemClock.elapsedRealtime())
    quietSince = step.quietSince
    if (!step.turnOff) return false
    Log.i(TAG, "PhoneCanDo is in the background and no agent wants the screen: Auto off turns accessibility off")
    AutoOff.markTurnedOff(context)
    stop()
    turnOff()
    return true
  }

  private companion object {
    const val TAG = "PhoneCanDoAutoOff"
  }
}
