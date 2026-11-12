package com.phonecando.runner.engine.work

// Which agents the runner stops by itself, freeing their memory: only with
// the app in the background, and only an agent that is ready, idle by its
// kind's rule (never with a chat working), has no job left (AgentWork) and
// is not kept running (the user's switch, KeepRunning, or its own ask to
// stay up, KeepAsks). The app has been
// away for the kind's quiet time, so a quick look at another app (the
// browser on the agent's dev server) stops nothing, and the agent's last
// job ended that long ago, so it can still answer what the job printed.
// Nothing stops while an agent drives the screen (the bridge's screen
// lease): it may just have put PhoneCanDo in the background. Pure.
object ReclaimPolicy {
  /** [lastBusyAt]: epoch ms of the last look that found a job; null for none in this engine life. */
  data class Agent(
    val agentId: String,
    val ready: Boolean,
    val idle: Boolean,
    val busy: Boolean,
    val kept: Boolean,
    val quietMs: Long,
    val lastBusyAt: Long?,
  )

  /** [awaySince]: epoch ms the app was first seen in the background, null while in front. */
  fun toStop(agents: List<Agent>, awaySince: Long?, screenInUse: Boolean, now: Long): List<String> {
    if (awaySince == null || screenInUse) return emptyList()
    return agents.filter { a ->
      a.ready && a.idle && !a.busy && !a.kept &&
        now - awaySince >= a.quietMs &&
        (a.lastBusyAt == null || now - a.lastBusyAt >= a.quietMs)
    }.map { it.agentId }
  }
}
