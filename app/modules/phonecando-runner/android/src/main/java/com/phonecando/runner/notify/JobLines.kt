package com.phonecando.runner.notify

import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobTarget as LinuxTarget
import com.phonecando.models.jobs.JobTarget as ModelTarget
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.jobs.JobsAnchor

// The jobs running now as notifications of their own (ServicePlan), read
// from JobsAnchor at each render (PhoneCanDoServeService.plan): the model
// jobs (TransferLines), the Linux jobs (LinuxJobLines), PhoneCanDo's own
// update download, each with what its job's step says (a wait, a re-read),
// its bar, and where its tap lands: Models, the agent's page for its
// install or its machine's setup (Systems for a system's download or a
// machine with no agent left), Settings' Updates.
internal object JobLines {
  fun read(agents: List<AgentRecord>): List<ServiceItem> {
    val models = JobsAnchor.modelJobs().map {
      TransferLines.of(it.label, it.target.kind == ModelTarget.Kind.IMPORT, it.done, it.total, it.step)
        .item("model:${it.id}", LaunchTarget(LaunchTarget.MODELS, null), MODEL)
    }
    val linuxJobs = JobsAnchor.linuxJobs()
    InstallShares.retain(linuxJobs.mapTo(HashSet()) { it.id })
    // A script's own agent (the app tells it), else the machine's first.
    val agentOf = { job: Job ->
      InstallShares.of(job.id)?.agentId?.let { id -> agents.firstOrNull { it.id == id } }
        ?: agents.firstOrNull { it.imageId == job.target.id }
    }
    val lines = LinuxJobLines.of(
      linuxJobs, JobsAnchor::envName, { agentOf(it)?.name }, JobsAnchor::imageResetting, InstallShares::of,
    )
    val linux = linuxJobs.zip(lines) { job, line ->
      val target = if (job.target.kind == LinuxTarget.Kind.ENV) {
        LaunchTarget(LaunchTarget.ENV, null)
      } else {
        LaunchTarget.of(LaunchTarget.ENV, agentOf(job)?.id)
      }
      line.item("linux:${job.id}", target, LINUX)
    }
    val update = JobsAnchor.updateJob()?.let {
      TransferLines.of(UPDATE_LABEL, false, it.written, it.spec.size, it.step.wire)
        .item("update", LaunchTarget(LaunchTarget.UPDATES, null), UPDATE)
    }
    return models + linux + listOfNotNull(update)
  }

  // The update download's title: "PhoneCanDo update", "downloading 45%".
  private const val UPDATE_LABEL = "PhoneCanDo update"

  // What the lock screen shows instead: no names.
  private const val MODEL = "A model coming in"
  private const val LINUX = "A Linux job running"
  private const val UPDATE = "An update coming in"
}
