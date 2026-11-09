package com.phonecando.runner.engine.events

import com.phonecando.runner.engine.EventSource
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

// One daemon thread for the TUI engines' periodic event work (following
// their events files, noticing a TUI gone quiet): a task runs every
// [periodMs] until its handle is stopped, and a failed run is tried again
// at the next.
internal object EventTimers {
  private val scheduler = Executors.newSingleThreadScheduledExecutor { r ->
    Thread(r, "phonecando-engine-events").apply { isDaemon = true }
  }

  fun every(periodMs: Long, task: () -> Unit): EventSource {
    val future = scheduler.scheduleWithFixedDelay({ runCatching(task) }, 0, periodMs, TimeUnit.MILLISECONDS)
    return EventSource { future.cancel(false) }
  }
}
