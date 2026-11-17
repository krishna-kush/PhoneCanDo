package com.phonecando.runner.notify

import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobTarget

// One running Linux job as a notification line, with the share the app's
// bar shows for it:
// - an env's download as a transfer: "Ubuntu 24.04 · downloading 45%", and
//   its waits and re-reads (TransferLines);
// - its machine's setup over the whole setup: "Claude Code · setting up
//   62%" (SETUP_SPAN; a step's own bytes count only while unpacking);
// - a reset: "Claude Code · resetting", with the unpack's share while it
//   unpacks, as the app (env/parts/ImageStatus.tsx);
// - an agent's install or update script: "Claude Code · installing 34%",
//   the share the app's bar shows (InstallShares), none before it tells one.
// Pure.
internal object LinuxJobLines {
  /**
   * [envName]: an env's name; [imageAgent]: the name of the agent a job on
   * an image is for (a script's own agent on a shared machine);
   * [resetting]: the image is being reset, not set up;
   * [installShare]: the app's share for a script job, by job id.
   */
  fun of(
    jobs: List<Job>,
    envName: (String) -> String?,
    imageAgent: (Job) -> String?,
    resetting: (String) -> Boolean = { false },
    installShare: (String) -> InstallShares.Share? = { null },
  ): List<String> =
    jobs.map { job ->
      val id = job.target.id
      val progress = job.progress
      when (job.target.kind) {
        JobTarget.Kind.ENV -> TransferLines.of(envName(id) ?: ENV, false, progress.done, progress.total, job.step)
        JobTarget.Kind.IMAGE -> {
          val label = imageAgent(job) ?: IMAGE
          when {
            job.guestScript -> script(label, installShare(job.id))
            resetting(id) -> withShare("$label · resetting", unpackShare(progress.step, progress.done, progress.total))
            else -> withShare("$label · setting up", setupShare(progress.step, progress.done, progress.total))
          }
        }
      }
    }

  /** "Claude Code · installing 34%", "… · updating 34%"; no share before the app told one. */
  fun script(label: String, share: InstallShares.Share?): String {
    val verb = if (share?.updating == true) "updating" else "installing"
    return withShare("$label · $verb", share?.fraction)
  }

  /** The whole setup in 0..1, as the app's setupFraction (env/logic/steps.ts): where the step starts, plus its own bytes while unpacking. */
  fun setupShare(step: String, done: Long, total: Long?): Double {
    val (from, to) = SETUP_SPAN[step] ?: return 0.0
    return from + (to - from) * (unpackShare(step, done, total) ?: 0.0)
  }

  // Only unpacking counts its own bytes (done/total); the other setup steps
  // report their place in the whole setup, which SETUP_SPAN says instead.
  private fun unpackShare(step: String, done: Long, total: Long?): Double? =
    if (step == UNPACK && total != null && total > 0) (done.toDouble() / total).coerceIn(0.0, 1.0) else null

  // Whole percent, rounded down, so it never says 100% before the end.
  private fun withShare(line: String, share: Double?): String =
    if (share == null) line else "$line ${(share * 100).toInt().coerceIn(0, 100)}%"

  private const val UNPACK = "unpack"

  // Where each setup step starts and ends in the whole setup: the app's
  // SETUP_SPAN (env/logic/steps.ts); keep the two in step.
  private val SETUP_SPAN = mapOf(
    "start" to (0.0 to 0.02),
    "space" to (0.02 to 0.05),
    UNPACK to (0.05 to 0.8),
    "detect" to (0.8 to 0.85),
    "fixups" to (0.85 to 0.9),
    "shims" to (0.9 to 0.93),
    "seed" to (0.93 to 0.96),
    "measure" to (0.96 to 1.0),
  )

  // A record gone meanwhile.
  private const val ENV = "Linux"
  private const val IMAGE = "Linux machine"
}
