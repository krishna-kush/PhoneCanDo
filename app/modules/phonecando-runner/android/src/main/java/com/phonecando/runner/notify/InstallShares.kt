package com.phonecando.runner.notify

import java.util.concurrent.ConcurrentHashMap

// How far the app's bar says an agent's install or update script is, by
// its Linux job id, so the notification's line says the same
// (LinuxJobLines): the app works it out from the script's phases, time and
// bytes over the whole run (state/flows/logic/installProgress.ts), which
// one event alone cannot tell, so it is not worked out twice. The app tells
// it with each event of a run it follows (showInstallShare) and forgets it
// when the run ends; a job it no longer follows (a JS reload) keeps its
// last share, and a job that ended is forgotten at the next look ([retain]).
internal object InstallShares {
  /** [agentId]: the agent it installs (a machine may hold several); [fraction] in 0..1; [updating]: an update script, not an install. */
  data class Share(val agentId: String, val fraction: Double, val updating: Boolean)

  private val byJob = ConcurrentHashMap<String, Share>()

  /** The app's bar for job [jobId] now; a null [fraction] forgets it. */
  fun set(jobId: String, agentId: String, fraction: Double?, updating: Boolean) {
    if (fraction == null || fraction.isNaN()) byJob.remove(jobId) else byJob[jobId] = Share(agentId, fraction.coerceIn(0.0, 1.0), updating)
  }

  fun of(jobId: String): Share? = byJob[jobId]

  /** Forgets every job but [running]. */
  fun retain(running: Set<String>) {
    byJob.keys.retainAll(running)
  }
}
