package com.phonecando.runner.bridge

import android.content.Context
import com.phonecando.runner.PhoneCanDoRunnerModule
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.bridge.PromptRegistry.Kind
import com.phonecando.runner.bridge.PromptRegistry.Prompt
import com.phonecando.runner.notify.AgentNotices
import com.phonecando.runner.notify.AppForeground
import com.phonecando.runner.notify.LaunchTarget
import com.phonecando.runner.notify.LaunchTargets

// Brings PhoneCanDo forward for the bridge on a LaunchTarget: in front, the
// switch goes to the app at once (event + prefs); behind, the launch and
// the tap-to-open notification both carry the target to OpenTargetActivity,
// which hands it over when the app actually opens. The notification is the
// reliable path when Android blocks a background activity start (its
// PendingIntent is exempt). Also how a prompt reaches the user
// (PromptHost): the app's event, then the launch and a notification of its
// own while backgrounded.
class AppLauncher(private val context: Context) : PromptHost {
  private val notices = AgentNotices(context)

  fun isForeground(): Boolean = AppForeground.isForeground(context)

  /** The app is in front: switch it to `target` now. */
  fun show(target: LaunchTarget) = LaunchTargets.deliver(context, target)

  fun canLaunch(): Boolean = context.packageManager.getLaunchIntentForPackage(context.packageName) != null

  /** Starts PhoneCanDo on `target`; false when Android refused (background start). */
  fun launch(target: LaunchTarget): Boolean = LaunchTargets.open(context, target)

  /** /app's tap-to-return notice, in the agent's slot; true when notifications show. */
  fun notifyReturn(agent: AgentRecord, tab: String): Boolean =
    notices.post(AgentNotices.Notice(agent.id, AgentNotices.SLOT, agent.name, RETURN_TEXT, tab = tab))

  // In front, Home comes forward first so the dialog sits over the chat;
  // the dialog names the asking agent, so the user stays on the agent they
  // are on. The event carries the prompt to a running UI, and a closed UI
  // reads it from BridgePrompts on start. Backgrounded, we also try the
  // launch and post the prompt's own notification (one per prompt, taken
  // down when it ends); both open the asking agent's Home.
  override fun announce(prompt: Prompt): Boolean {
    val inFront = isForeground()
    if (inFront) show(LaunchTarget("home", null))
    PhoneCanDoRunnerModule.emitBridgePrompt(prompt.toMap())
    if (inFront) return false
    launch(LaunchTarget("home", prompt.agentId))
    val text = when (prompt.kind) {
      Kind.UNLOCK -> "Wants to control the phone. Tap to unlock."
      Kind.ACCESSIBILITY -> "Needs Accessibility permission. Tap to review."
    }
    return notices.post(
      AgentNotices.Notice(
        prompt.agentId, AgentNotices.promptId(prompt.seq), prompt.agentName, text,
      ),
    )
  }

  override fun withdraw(prompt: Prompt) {
    notices.cancel(prompt.agentId, AgentNotices.promptId(prompt.seq))
  }

  private companion object {
    const val RETURN_TEXT = "Done with the phone. Tap to return."
  }
}
