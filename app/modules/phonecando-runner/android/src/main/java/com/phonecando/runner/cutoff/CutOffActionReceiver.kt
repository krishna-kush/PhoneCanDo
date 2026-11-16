package com.phonecando.runner.cutoff

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.phonecando.runner.cutoff.CutOffLook.Why

// Where a cut-off notice's Continue and Dismiss (and its swipe) land
// (CutOffNotice), in our process. Continue starts the agent at once: your
// tap is what lets Android start our service from the background, and that
// leave lasts only seconds. Not exported: only our own PendingIntents send
// it, each with its own identifier, so one agent's buttons never carry
// another's.
class CutOffActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val agentId = intent.getStringExtra(EXTRA_AGENT)?.takeIf { it.isNotEmpty() } ?: return
    val why = Why.of(intent.getStringExtra(EXTRA_WHY)) ?: Why.CLOSED
    val cutOffs = CutOffs.get(context)
    val pending = goAsync()
    when (intent.action) {
      ACTION_CONTINUE -> cutOffs.bring(agentId, why, pending::finish)
      ACTION_DISMISS -> cutOffs.dismiss(agentId, pending::finish)
      else -> pending.finish()
    }
    // A process started for this tap offers the other agents' runs too (once).
    cutOffs.look(CutOffLook.Trigger.START)
  }

  companion object {
    const val ACTION_CONTINUE = "com.phonecando.runner.CUT_OFF_CONTINUE"
    const val ACTION_DISMISS = "com.phonecando.runner.CUT_OFF_DISMISS"
    private const val EXTRA_AGENT = "agentId"
    private const val EXTRA_WHY = "why"

    internal fun intent(context: Context, agentId: String, action: String, why: Why): PendingIntent {
      val i = Intent(context, CutOffActionReceiver::class.java)
        .setAction(action)
        .setIdentifier("cutoff|$action|$agentId")
        .putExtra(EXTRA_AGENT, agentId)
        .putExtra(EXTRA_WHY, why.wire)
      return PendingIntent.getBroadcast(context, 0, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
  }
}
