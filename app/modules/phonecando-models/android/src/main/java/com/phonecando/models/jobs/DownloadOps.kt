package com.phonecando.models.jobs

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.store.download.DownloadRequest
import com.phonecando.models.ModelsHost
import com.phonecando.models.errors.ModelError
import com.phonecando.models.errors.ModelErrorCode

/**
 * Downloads as background jobs. A start registers the download in
 * models.json first (so it survives an app restart as a pending download
 * with its `.part` files) and runs it; a dropped connection, a server error
 * or a rate limit waits and resumes with `Range` by itself (RetryPolicy); a
 * cancel stops it and keeps what arrived, so Resume carries on. The token
 * is read again for each try.
 */
class DownloadOps(private val host: ModelsHost) {
  /** Registers [request] and starts it; the same request still pending resumes. @throws ModelError busy when it runs. */
  fun start(request: DownloadRequest): ModelJob {
    val pending = host.store.startDownload(request)
    host.changed()
    return run(pending.id, pending.name)
  }

  /** Runs pending download [id] again. @throws LmeException.NotFound when there is none. */
  fun resume(id: String): ModelJob {
    val pending = host.store.downloads().firstOrNull { it.id == id } ?: throw LmeException.NotFound("download $id")
    return run(pending.id, pending.name)
  }

  /** The running job of download [id], if any. */
  fun jobOf(id: String): ModelJob? = host.jobs.live(target(id))

  /** Removes download or model [id] and its files, stopping its job first. */
  fun delete(id: String) {
    host.jobs.cancelAndAwait(target(id), STOP_WAIT_MS)
    host.store.delete(id)
    host.changed()
  }

  private fun run(id: String, name: String): ModelJob {
    val job = host.jobs.begin(target(id), name)
    host.run(job) { reporter -> download(id, job, reporter) }
    return job
  }

  private fun download(id: String, job: ModelJob, reporter: JobReporter) {
    var attempt = 0
    var doneBefore = -1L
    while (true) {
      try {
        host.store.download(id, host.tokens.read(), reporter, job.cancel)
        return
      } catch (e: LmeException) {
        if (!RetryPolicy.retryable(e) || job.isCancelled) throw e
        if (reporter.mostDone > doneBefore) attempt = 0
        doneBefore = reporter.mostDone
        attempt++
        val delay = RetryPolicy.delayMillis(attempt) ?: throw e
        reporter.retrying(RetryWait(attempt, RetryPolicy.MAX_ATTEMPTS, delay))
        sleep(job, delay)
      }
    }
  }

  // Waits, checking the cancel flag a few times a second.
  private fun sleep(job: ModelJob, millis: Long) {
    val until = System.currentTimeMillis() + millis
    while (System.currentTimeMillis() < until) {
      if (job.isCancelled) throw LmeException.Cancelled()
      Thread.sleep(minOf(POLL_MS, until - System.currentTimeMillis()).coerceAtLeast(1))
    }
  }

  private fun target(id: String) = JobTarget(JobTarget.Kind.DOWNLOAD, id)

  private companion object {
    const val POLL_MS = 250L
    const val STOP_WAIT_MS = 10_000L
  }
}
