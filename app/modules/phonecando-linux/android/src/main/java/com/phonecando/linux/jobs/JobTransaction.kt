package com.phonecando.linux.jobs

import com.phonecando.linux.records.LinuxRecords

/**
 * A record transaction that registers a job: [block] gets `begin` for the
 * job's target, so the busy check and the record change (`creating`,
 * `downloading`) are one step. When the transaction fails after that (a
 * check, or writing the records), the job ends again, so its target is not
 * left busy for the rest of the process. Pure JVM.
 */
fun <T> LinuxRecords.transactWithJob(
  jobs: JobRegistry,
  block: LinuxRecords.Transaction.(begin: (JobTarget) -> Job) -> T,
): T {
  var begun: Job? = null
  try {
    return transact { block { target -> jobs.begin(target).also { begun = it } } }
  } catch (e: Throwable) {
    begun?.let(jobs::end)
    throw e
  }
}
