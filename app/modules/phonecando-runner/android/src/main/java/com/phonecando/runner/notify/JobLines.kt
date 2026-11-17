package com.phonecando.runner.notify

import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobTarget as LinuxTarget
import com.phonecando.models.jobs.JobTarget as ModelTarget
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.jobs.JobsAnchor

// The service notification's lines for the jobs running now, read from
// JobsAnchor at each render (PhoneCanDoServeService.content): the model
// jobs (TransferLines), the Linux jobs (LinuxJobLines), PhoneCanDo's own
// update download, each with what its job's step says (a wait, a re-read),
// and where a tap on each lands (ServiceTap): Models, the agent's page for
// its install or its machine's setup (Systems for a system's download or
// a machine with no agent left), Settings' Updates.
internal object JobLines {
  data class Lines(
    val transfers: List<String>,
    val linux: List<String>,
    val update: String?,
    val places: List<LaunchTarget>,
  )

  fun read(agents: List<AgentRecord>): Lines {
    val models = JobsAnchor.modelJobs()
    val transfers = models.map { TransferLines.of(it.label, it.target.kind == ModelTarget.Kind.IMPORT, it.done, it.total, it.step) }
    val linuxJobs = JobsAnchor.linuxJobs()
    InstallShares.retain(linuxJobs.mapTo(HashSet()) { it.id })
    // A script's own agent (the app tells it), else the machine's first.
    val agentOf = { job: Job ->
      InstallShares.of(job.id)?.agentId?.let { id -> agents.firstOrNull { it.id == id } }
        ?: agents.firstOrNull { it.imageId == job.target.id }
    }
    val linux = LinuxJobLines.of(
      linuxJobs, JobsAnchor::envName, { agentOf(it)?.name }, JobsAnchor::imageResetting, InstallShares::of,
    )
    val update = JobsAnchor.updateJob()?.let { TransferLines.of(UPDATE_LABEL, false, it.written, it.spec.size, it.step.wire) }
    val places = models.map { LaunchTarget(LaunchTarget.MODELS, null) } +
      linuxJobs.map { job ->
        if (job.target.kind == LinuxTarget.Kind.ENV) LaunchTarget(LaunchTarget.ENV, null) else LaunchTarget.of(LaunchTarget.ENV, agentOf(job)?.id)
      } +
      listOfNotNull(update?.let { LaunchTarget(LaunchTarget.UPDATES, null) })
    return Lines(transfers, linux, update, places)
  }

  // The update download's line: "PhoneCanDo update · downloading 45%".
  private const val UPDATE_LABEL = "PhoneCanDo update"
}
