package com.phonecando.runner.bridge

import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.appaccess.AppVerdict
import com.phonecando.runner.bridge.PromptRegistry.Kind
import com.phonecando.runner.bridge.PromptRegistry.Prompt

/** How a prompt reaches the user: the app's event, a launch and a notification. */
interface PromptHost {
  /** Tells the app about a new prompt; true when a notification was posted. */
  fun announce(prompt: Prompt): Boolean

  /** The prompt ended: take its notification down. */
  fun withdraw(prompt: Prompt)
}

data class UnlockOutcome(val requested: Boolean, val unlocked: Boolean, val notified: Boolean)

data class AccessibilityOutcome(
  val opened: Boolean,
  val enabled: Boolean,
  val cancelled: Boolean,
  val notified: Boolean,
  val guided: Boolean,
)

/** `answer`: this prompt's own answer ("always", "once", "no"), null when none came. */
data class AppOutcome(
  val asked: Boolean,
  val allowed: Boolean,
  val blocked: Boolean,
  val answer: String?,
  val notified: Boolean,
)

// The waits behind /unlock, /accessibility and /app-access. Each request registers its own
// prompt and waits on it alone, so a second agent's request never orphans
// the first; the conditions they wait for stay global. The biometric gate
// is one switch for the phone: when any unlock succeeds, every waiting
// unlock request sees the gate on and returns unlocked. Likewise the
// accessibility service: once it connects, every accessibility request
// returns enabled. The waits poll because neither switch calls back. Pure:
// clock and sleep injected.
class PromptFlows(
  private val registry: PromptRegistry,
  private val host: PromptHost,
  private val clock: () -> Long = System::currentTimeMillis,
  private val sleep: (Long) -> Unit = Thread::sleep,
) {
  // The app's modal is the only place the gate flips; the agent never sees a
  // credential. Blocks until the user answers this prompt, the gate turns on
  // (this or another prompt's unlock) or `waitMs` runs out.
  fun unlock(agent: AgentRecord, reason: String, waitMs: Long, gateOn: () -> Boolean): UnlockOutcome {
    if (gateOn()) return UnlockOutcome(requested = false, unlocked = true, notified = false)
    val prompt = registry.open(Kind.UNLOCK, agent.id, agent.name, reason)
    try {
      val notified = host.announce(prompt)
      waitUntil(waitMs, UNLOCK_POLL_MS) { prompt.answer != null || gateOn() }
      return UnlockOutcome(requested = true, unlocked = gateOn() || prompt.answer == true, notified = notified)
    } finally {
      end(prompt)
    }
  }

  // Waits for PhoneCanDo's accessibility service, so the agent carries on by
  // itself once the user has switched it on. Ends early when the user taps
  // "Not now" on this prompt. The user must flip the system toggle; the
  // agent cannot.
  fun accessibility(
    agent: AgentRecord,
    reason: String,
    waitMs: Long,
    connected: () -> Boolean,
  ): AccessibilityOutcome {
    if (connected()) {
      return AccessibilityOutcome(opened = false, enabled = true, cancelled = false, notified = false, guided = false)
    }
    val prompt = registry.open(Kind.ACCESSIBILITY, agent.id, agent.name, reason)
    return try {
      val notified = host.announce(prompt)
      waitUntil(waitMs, ACCESSIBILITY_POLL_MS) { prompt.cancelled || connected() }
      val enabled = connected()
      AccessibilityOutcome(
        opened = prompt.opened,
        enabled = enabled,
        cancelled = !enabled && prompt.cancelled,
        notified = notified,
        guided = prompt.guided,
      )
    } finally {
      end(prompt)
    }
  }

  // The question about one app (appaccess/). Blocks until the user answers
  // this prompt, the app's verdict for this agent is no longer ASK
  // (another agent's question about it was answered, or Settings changed
  // it) or `waitMs` runs out. The app applies an answer, then records it,
  // both under the prompt's lock (BridgePrompts.resolveApp), so the final
  // look here sees both or neither.
  fun app(agent: AgentRecord, pkg: String, label: String, waitMs: Long, verdict: () -> AppVerdict): AppOutcome {
    when (verdict()) {
      AppVerdict.ALLOWED -> return AppOutcome(asked = false, allowed = true, blocked = false, answer = null, notified = false)
      AppVerdict.BLOCKED -> return AppOutcome(asked = false, allowed = false, blocked = true, answer = null, notified = false)
      AppVerdict.ASK -> {}
    }
    val prompt = registry.open(Kind.APP, agent.id, agent.name, APP_REASON, pkg, label)
    try {
      val notified = host.announce(prompt)
      waitUntil(waitMs, APP_POLL_MS) { prompt.appAnswer != null || prompt.cancelled || verdict() != AppVerdict.ASK }
      return synchronized(prompt) {
        val now = verdict()
        AppOutcome(
          asked = true,
          allowed = now == AppVerdict.ALLOWED,
          blocked = now == AppVerdict.BLOCKED,
          answer = prompt.appAnswer,
          notified = notified,
        )
      }
    } finally {
      end(prompt)
    }
  }

  private fun waitUntil(waitMs: Long, pollMs: Long, done: () -> Boolean) {
    val deadline = clock() + waitMs
    try {
      while (!done() && clock() < deadline) sleep(pollMs)
    } catch (_: InterruptedException) {
      Thread.currentThread().interrupt()
    }
  }

  private fun end(prompt: Prompt) {
    registry.close(prompt)
    runCatching { host.withdraw(prompt) }
  }

  private companion object {
    const val UNLOCK_POLL_MS = 100L
    const val ACCESSIBILITY_POLL_MS = 250L
    const val APP_POLL_MS = 100L
    const val APP_REASON = "app_access"
  }
}
