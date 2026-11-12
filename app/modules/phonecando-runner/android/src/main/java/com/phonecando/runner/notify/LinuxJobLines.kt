package com.phonecando.runner.notify

import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobTarget

// One running Linux job as a notification line: "Ubuntu 24.04 ·
// downloading 45%" (an env), "Claude Code · setting up 60%" (its machine's
// create or reset), "Claude Code · installing" (a guest script, whose steps
// have no share). The share only when the step knows its total. Pure.
internal object LinuxJobLines {
  enum class Kind(val verb: String) { DOWNLOAD("downloading"), SETUP("setting up"), INSTALL("installing") }

  /** [envName]: an env's name; [imageAgent]: the name of the agent an image belongs to. */
  fun of(jobs: List<Job>, envName: (String) -> String?, imageAgent: (String) -> String?): List<String> =
    jobs.map { job ->
      val id = job.target.id
      val progress = job.progress
      when (job.target.kind) {
        JobTarget.Kind.ENV -> of(envName(id) ?: ENV, Kind.DOWNLOAD, progress.done, progress.total)
        JobTarget.Kind.IMAGE -> if (job.guestScript) {
          of(imageAgent(id) ?: IMAGE, Kind.INSTALL, 0, null)
        } else {
          of(imageAgent(id) ?: IMAGE, Kind.SETUP, progress.done, progress.total)
        }
      }
    }

  fun of(label: String, kind: Kind, done: Long, total: Long?): String {
    val share = if (total != null && total > 0) " ${(done * 100 / total).coerceIn(0, 100)}%" else ""
    return "$label · ${kind.verb}$share"
  }

  // A record gone meanwhile.
  private const val ENV = "Linux"
  private const val IMAGE = "Linux machine"
}
