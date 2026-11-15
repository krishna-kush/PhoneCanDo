package com.phonecando.runner.checks.fanout

import android.content.Context
import android.util.Log
import com.phonecando.runner.checks.CheckChange
import com.phonecando.runner.checks.Checks
import com.phonecando.runner.checks.now.CheckNow
import com.phonecando.runner.notify.CheckNotices
import java.util.concurrent.CopyOnWriteArrayList

// Where a check's news goes, on the thread Checks calls from:
// - a change: whoever listens (the scheduler's Firing: a task check failing
//   inside a start's window fails that run), a Check now running for the
//   agent (it answers that capability's row), on a capability's first
//   failure one notification (notify/CheckNotices), then the app
//   (ChecksEvents).
// - an engine life's turn end or end: Check now's run (checks/now).
// PhoneCanDoServeService installs it once, right after Checks.init.
object CheckFanOut {
  private const val TAG = "PhoneCanDoChecks"

  private val listeners = CopyOnWriteArrayList<(CheckChange) -> Unit>()

  fun install(context: Context) {
    val notices = CheckNotices(context.applicationContext ?: context)
    Checks.onChange = { change -> changed(notices, change) }
    Checks.onLife = { agentId, event -> guarded("check now") { CheckNow.life(agentId, event) } }
  }

  /** [listener] hears every change from now on (it lives as long as the process). */
  fun listen(listener: (CheckChange) -> Unit) {
    listeners.addIfAbsent(listener)
  }

  private fun changed(notices: CheckNotices, change: CheckChange) {
    for (listener in listeners) guarded("listener") { listener(change) }
    guarded("check now") { CheckNow.verdict(change) }
    if (change.firstFailure) guarded("notice") { notices.post(change) }
    ChecksEvents.changed(change.agentId)
  }

  private inline fun guarded(what: String, block: () -> Unit) {
    try {
      block()
    } catch (e: Exception) {
      Log.w(TAG, "check $what failed", e)
    }
  }
}
