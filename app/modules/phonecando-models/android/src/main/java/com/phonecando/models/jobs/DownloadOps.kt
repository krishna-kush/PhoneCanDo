package com.phonecando.models.jobs

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.store.download.DownloadRequest
import com.phonecando.models.ModelsHost
import com.phonecando.models.errors.ModelError

/**
 * Downloads as background jobs. A start registers the download in
 * models.json first (so it survives an app restart as a pending download
 * with its `.part` files) and runs it; a dropped connection, a server error
 * or a rate limit waits and resumes with `Range` by itself, and with no
 * network it waits for one (RetryLoop); a cancel stops it and keeps what
 * arrived, so Resume carries on. One the process or a long outage stopped
 * runs again on the next start ([resumeInterrupted], ResumeList). The token
 * is read again for each try.
 */
class DownloadOps(private val host: ModelsHost) {
  private val retries = RetryLoop(online = host.network::online)

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

  /** Runs again, once per process, the downloads the last one left running; the rest of the list goes. */
  fun resumeInterrupted() {
    val pending = host.store.downloads().associateBy { it.id }
    for (id in host.resumeList.ids()) {
      val download = pending[id]
      if (download == null) {
        host.resumeList.remove(id)
        continue
      }
      try {
        run(download.id, download.name)
      } catch (_: ModelError) {
        // Already running.
      }
    }
  }

  /** The running job of download [id], if any. */
  fun jobOf(id: String): ModelJob? = host.jobs.live(target(id))

  /** Removes download or model [id] and its files, stopping its job first. */
  fun delete(id: String) {
    host.jobs.cancelAndAwait(target(id), STOP_WAIT_MS)
    host.store.delete(id)
    host.resumeList.remove(id)
    host.changed()
  }

  private fun run(id: String, name: String): ModelJob {
    val job = host.jobs.begin(target(id), name)
    host.resumeList.add(id)
    host.run(job) { reporter ->
      try {
        retries.run(reporter, { job.isCancelled }, { sleep(job, it) }) {
          host.store.download(id, host.tokens.read(), reporter, job.cancel)
        }
        host.resumeList.remove(id)
      } catch (e: Throwable) {
        // It stays on the list only for what a later start can fix: a network that stayed down.
        if (!RetryPolicy.retryable(e)) host.resumeList.remove(id)
        throw e
      }
    }
    return job
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

    // Past a connect and a wait for the answer's headers (UrlConnectionPort: 15 s + 30 s), which
    // a cancel cannot cut short; a read on the body it cuts at once.
    const val STOP_WAIT_MS = 50_000L
  }
}
