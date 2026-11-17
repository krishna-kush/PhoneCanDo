package com.phonecando.runner.notify

/**
 * Where opening PhoneCanDo should land: a place in the app and, when the
 * reason is one agent (its notification, its return, its prompt), that
 * agent, which the app then makes active. "env" is that agent's page (no
 * agent: Systems); "checks" that agent's checks (a capability that stopped
 * working, notify/CheckNotices); "models" the Models page (a model job);
 * "updates" Settings' Updates page (the update download); "memory" the RAM
 * warning (MemoryNotices). JS sees `{tab, agentId}` (runner.ts
 * LaunchTarget). Pure.
 */
data class LaunchTarget(val tab: String, val agentId: String?) {
  /** Tells two targets' notification taps apart (LaunchTargets.intent). */
  val key: String get() = "${agentId.orEmpty()}/$tab"

  fun toMap(): Map<String, Any?> = mapOf("tab" to tab, "agentId" to agentId)

  companion object {
    const val HOME = "home"
    const val ENV = "env"
    const val CHECKS = "checks"
    const val MODELS = "models"
    const val UPDATES = "updates"
    const val MEMORY = "memory"

    val TABS = setOf(HOME, ENV, "settings", CHECKS, MODELS, UPDATES, MEMORY)

    /** An unknown or missing tab is Home; a blank agent id is none. */
    fun of(tab: String?, agentId: String?) = LaunchTarget(
      tab?.takeIf { it in TABS } ?: HOME,
      agentId?.takeIf { it.isNotBlank() },
    )
  }
}
