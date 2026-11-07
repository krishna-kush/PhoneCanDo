package com.phonecando.runner.bridge

// Prompts the bridge is waiting on (biometric unlock, accessibility setup),
// one per asking request, each with its own requestId. The native module
// exposes these to JS as pendingPrompts / resolveUnlock / resolveAccessibility
// and emits `phonecandoBridgePrompt` with the same map shape:
//   requestId, kind ("unlock" | "accessibility"), agentId, agentName, reason.
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
}
