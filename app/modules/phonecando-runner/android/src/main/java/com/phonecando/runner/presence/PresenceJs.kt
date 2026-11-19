package com.phonecando.runner.presence

// The presence as JS sees it (presenceSnapshot, the phonecandoPresence
// event; app/src/engine/presence/types.ts mirrors it):
//   {driver: {agentId, name} | null,
//    handOver: {agentId, agentName, mode: "watch"|"paused", by: "user"|"agent", why} | null,
//    statuses: {[agentId]: {text, mood: "working"|"thinking"|"waiting"}}}
// Pure.
object PresenceJs {
  fun of(frame: PresenceFrame): Map<String, Any?> = mapOf(
    "driver" to frame.driver?.let { mapOf("agentId" to it.agentId, "name" to it.name) },
    "handOver" to frame.handOver?.let {
      mapOf(
        "agentId" to it.agentId,
        "agentName" to it.agentName,
        "mode" to it.mode.name.lowercase(),
        "by" to it.by.name.lowercase(),
        "why" to it.why,
      )
    },
    "statuses" to frame.statuses.mapValues { (_, s) -> mapOf("text" to s.text, "mood" to s.mood.name.lowercase()) },
  )

  /** A UserAct by its name ("LET_ME", any case); null for none. */
  fun act(name: String): UserAct? = UserAct.entries.firstOrNull { it.name.equals(name.trim(), ignoreCase = true) }
}
