package com.phonecando.runner.appaccess

// The user's "Just now" answers: apps one agent may use until it hands the
// phone back (phone_return) or its engine stops, the moment an ask-mode
// unlock ends too. Memory only. Pure.
class JustNowGrants {
  private val apps = HashMap<String, MutableSet<String>>()

  @Synchronized
  fun grant(agentId: String, pkg: String) {
    apps.getOrPut(agentId) { HashSet() } += pkg
  }

  @Synchronized
  fun of(agentId: String): Set<String> = apps[agentId]?.toSet() ?: emptySet()

  @Synchronized
  fun end(agentId: String) {
    apps.remove(agentId)
  }

  @Synchronized
  fun clear() {
    apps.clear()
  }

  /** The user changed [pkg] in Settings: no agent keeps an earlier "Just now" for it. */
  @Synchronized
  fun dropApp(pkg: String) {
    apps.values.forEach { it -= pkg }
  }
}
