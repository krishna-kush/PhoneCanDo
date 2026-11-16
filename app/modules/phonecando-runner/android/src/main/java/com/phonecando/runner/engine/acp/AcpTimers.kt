package com.phonecando.runner.engine.acp

import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/** One daemon thread for every ACP engine's timers: a call's timeout, a start's wait for its work, a turn's looks. */
internal object AcpTimers {
  private val scheduler = Executors.newSingleThreadScheduledExecutor { r ->
    Thread(r, "phonecando-acp-timers").apply { isDaemon = true }
  }

  fun after(ms: Long, task: Runnable): ScheduledFuture<*> = scheduler.schedule(task, ms, TimeUnit.MILLISECONDS)

  /** [task] every [ms] from [ms] on, until its future is cancelled; a task that throws ends it. */
  fun every(ms: Long, task: Runnable): ScheduledFuture<*> = scheduler.scheduleWithFixedDelay(task, ms, ms, TimeUnit.MILLISECONDS)
}
