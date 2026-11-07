package com.phonecando.runner.notify

/**
 * Where opening PhoneCanDo should land: a footer tab and, when the reason is
 * one agent (its notification, its return, its prompt), that agent, which
 * the app then makes active. JS sees `{tab, agentId}` (runner.ts
 * LaunchTarget). Pure.
 */
data class LaunchTarget(val tab: String, val agentId: String?) {
  /** Tells two targets' notification taps apart (LaunchTargets.intent). */
  val key: String get() = "${agentId.orEmpty()}/$tab"

  fun toMap(): Map<String, Any?> = mapOf("tab" to tab, "agentId" to agentId)

  companion object {
    val TABS = setOf("home", "env", "settings")

    /** An unknown or missing tab is Home; a blank agent id is none. */
    fun of(tab: String?, agentId: String?) = LaunchTarget(
      tab?.takeIf { it in TABS } ?: "home",
      agentId?.takeIf { it.isNotBlank() },
    )
  }
}
