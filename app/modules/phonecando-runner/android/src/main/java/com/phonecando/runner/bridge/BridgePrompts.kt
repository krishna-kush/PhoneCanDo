package com.phonecando.runner.bridge

import com.phonecando.runner.appaccess.AppAccess

// Prompts the bridge is waiting on (biometric unlock, accessibility setup,
// an app agents want to use), one per asking request, each with its own
// requestId. The native module exposes these to JS as pendingPrompts /
// resolveUnlock / resolveAccessibility / resolveAppAccess and emits
// `phonecandoBridgePrompt` with the same map shape:
//   requestId, kind ("unlock" | "accessibility" | "app"), agentId,
//   agentName, reason; an app prompt adds package and label.
// One registry per process: the app answers prompts whether or not it was
// open when they were made.
object BridgePrompts {
  internal val registry = PromptRegistry()

  fun pending(): List<Map<String, Any?>> = registry.pending().map { it.toMap() }

  /** The user's answer to one unlock prompt (biometrics done or "Not now"). */
  fun resolveUnlock(requestId: String, ok: Boolean) {
    registry.answerUnlock(requestId, ok)
  }

  // Progress on one accessibility prompt: ok when the user opened a step's
  // screen (guided: a restricted-settings guide step), not ok for "Not now",
  // which ends that request's wait.
  fun resolveAccessibility(requestId: String, ok: Boolean, guided: Boolean) {
    registry.progressAccessibility(requestId, ok, guided)
  }

  /** The user has an app or unlock question to answer in PhoneCanDo (appaccess/OwnQuestions). */
  fun userDeciding(): Boolean = registry.pending().any { it.kind == PromptRegistry.Kind.APP || it.kind == PromptRegistry.Kind.UNLOCK }

  // The user's answer to one app prompt, applied before it is recorded:
  // "always" (right after the biometric; false, the prompt left waiting,
  // when the signature was refused), "once" for the asking agent alone, or
  // "no" for every agent. Both happen under the prompt's lock, which the
  // wait's last look takes too (PromptFlows.app). False when the prompt is
  // gone or the answer is unknown.
  fun resolveApp(access: AppAccess, requestId: String, answer: String): Boolean {
    if (answer !in PromptRegistry.APP_ANSWERS) return false
    val prompt = registry.waitingApp(requestId) ?: return false
    val pkg = prompt.pkg ?: return false
    synchronized(prompt) {
      val applied = when (answer) {
        "always" -> access.setAlways(pkg)
        "once" -> {
          access.grantOnce(prompt.agentId, pkg)
          true
        }
        else -> {
          access.block(pkg)
          true
        }
      }
      return applied && registry.answerApp(requestId, answer)
    }
  }
}
