package com.phonecando.runner.notify

/**
 * Where opening PhoneCanDo should land: a place in the app and, when the
 * reason is one agent (its notification, its return, its prompt), that
 * agent, which the app then makes active. "env" is that agent's page (no
 * agent: Systems); "checks" that agent's checks (a capability that stopped
 * working, notify/CheckNotices); "models" the Models page (a model job);
 * "updates" Settings' Updates page (the update download); "memory" the RAM
 * warning (MemoryNotices). [chatId]: on Home, that agent's chat (a
 * scheduled run's, schedule/reply/). JS sees `{tab, agentId, chatId}`
 * (runner.ts LaunchTarget). Pure.
 */
data class LaunchTarget(val tab: String, val agentId: String?, val chatId: String? = null) {
  /** Tells two targets' notification taps apart (LaunchTargets.intent); each chat its own. */
  val key: String get() = "${agentId.orEmpty()}/$tab" + chatId?.let { "/$it" }.orEmpty()

  fun toMap(): Map<String, Any?> = mapOf("tab" to tab, "agentId" to agentId, "chatId" to chatId)

  companion object {
    const val HOME = "home"
    const val ENV = "env"
    const val CHECKS = "checks"
    const val MODELS = "models"
    const val UPDATES = "updates"
    const val MEMORY = "memory"

    val TABS = setOf(HOME, ENV, "settings", CHECKS, MODELS, UPDATES, MEMORY)

    /** An unknown or missing tab is Home; a blank agent or chat id is none, and so is a chat with no agent. */
    fun of(tab: String?, agentId: String?, chatId: String? = null): LaunchTarget {
      val agent = agentId?.takeIf { it.isNotBlank() }
      return LaunchTarget(tab?.takeIf { it in TABS } ?: HOME, agent, chatId?.takeIf { agent != null && it.isNotBlank() })
    }
  }
}
