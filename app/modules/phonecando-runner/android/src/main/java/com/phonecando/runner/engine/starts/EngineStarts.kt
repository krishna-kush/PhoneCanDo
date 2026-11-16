package com.phonecando.runner.engine.starts

import android.content.Context
import android.content.Intent
import android.util.Log
import com.phonecando.runner.PhoneCanDoServeService
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.MachinePrep
import com.phonecando.runner.engine.StartPrompts

// How a scheduled task (or a message for an agent in terminal mode that
// switches to ACP mode, messages/) gets an engine to work: the same start
// request the app sends (PhoneCanDoServeService ACTION_START), in ACP mode
// when asked (EXTRA_MODE "acp": the engine starts in it, or switches to it
// from terminal mode), with the task as its first prompt when the kind
// takes one (StartPrompts, which the start's plan takes, or the ACP driver
// sends); with no app around to ready the machine, the start readies it
// itself (MachinePrep). For an engine that already runs in that mode the
// request returns at once, and lifts the service to the foreground for the
// run a wake begins.
// Schedules call it only inside an alarm's leave to start the service from
// the background (ScheduleAlarmReceiver), or with the app in front; a
// message's switch calls it while the agent's terminal engine runs, and
// falls back to the inbox folder when refused. Android refusing it
// (ForegroundServiceStartNotAllowedException, an IllegalStateException) is
// a reason, and the prompt is taken back so a later start never runs it.
internal class EngineStarts(context: Context) {
  private val app = context.applicationContext ?: context

  /**
   * Asks the service to start (or hold) [agentId]'s engine in [mode]; null
   * when it took the request, else why not. [sameChat]: the prompt goes on
   * in the chat the start reopens, never in a new one (StartPrompt).
   */
  fun start(
    agentId: String,
    prompt: String? = null,
    newChat: Boolean = false,
    mode: EngineMode = EngineMode.TERMINAL,
    sameChat: Boolean = false,
  ): String? {
    prompt?.let { StartPrompts.put(agentId, it, newChat, sameChat) }
    MachinePrep.mark(agentId)
    return try {
      val intent = Intent(app, PhoneCanDoServeService::class.java)
        .setAction(PhoneCanDoServeService.ACTION_START)
        .putExtra(PhoneCanDoServeService.EXTRA_AGENT_ID, agentId)
      if (mode == EngineMode.ACP) intent.putExtra(PhoneCanDoServeService.EXTRA_MODE, mode.wire)
      app.startForegroundService(intent)
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
