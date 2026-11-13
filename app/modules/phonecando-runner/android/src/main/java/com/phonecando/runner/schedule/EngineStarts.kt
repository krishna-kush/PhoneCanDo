package com.phonecando.runner.schedule

import android.content.Context
import android.content.Intent
import android.util.Log
import com.phonecando.runner.PhoneCanDoServeService
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.MachinePrep
import com.phonecando.runner.engine.StartPrompts

// How a scheduled task gets an engine to work: the same start request the
// app sends (PhoneCanDoServeService ACTION_START), with the task as its
// first prompt when the kind takes one (StartPrompts, which the start's
// plan takes); with no app around to ready the machine, the start readies
// it itself (MachinePrep). For an engine that already runs the request returns at
// once, and lifts the service to the foreground for the run a wake begins.
// Called only inside an alarm's leave to start the service from the
// background (ScheduleAlarmReceiver), or with the app in front; Android
// refusing it (ForegroundServiceStartNotAllowedException, an
// IllegalStateException) is a reason, and the prompt is taken back so a
// later start never runs it.
internal class EngineStarts(context: Context) {
  private val app = context.applicationContext ?: context

  /** Asks the service to start (or hold) [agentId]'s engine; null when it took the request, else why not. */
  fun start(agentId: String, prompt: String? = null, newChat: Boolean = false): String? {
    prompt?.let { StartPrompts.put(agentId, it, newChat) }
    MachinePrep.mark(agentId)
    return try {
      app.startForegroundService(
        Intent(app, PhoneCanDoServeService::class.java)
          .setAction(PhoneCanDoServeService.ACTION_START)
          .putExtra(PhoneCanDoServeService.EXTRA_AGENT_ID, agentId),
      )
      null
    } catch (e: IllegalStateException) {
      if (prompt != null) StartPrompts.take(agentId)
      MachinePrep.take(agentId)
      Log.w(TAG, "start of $agentId refused", e)
      REFUSED
    } catch (e: SecurityException) {
      if (prompt != null) StartPrompts.take(agentId)
      MachinePrep.take(agentId)
      Log.w(TAG, "start of $agentId refused", e)
      REFUSED
    }
  }

  /** Stops [agentId]'s engine and what it started, as a user stop; blocks up to ~3 s. */
  fun stop(agentId: String) {
    Engines.get(app).stop(agentId)
  }

  companion object {
    private const val TAG = "PhoneCanDoSchedules"
    const val REFUSED = "Android did not let PhoneCanDo start in the background"
  }
}
