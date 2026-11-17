package com.phonecando.runner.update

import com.phonecando.network.CancelSignal
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * One running update download: its spec, the cancel flag network polls and
 * its reporter's live state. [discard] cancels it for good (a stop, or a
 * start of another spec): from then on it says nothing more, keeps no
 * record and, as it ends, deletes the files it may still have written.
 */
class UpdateJob(val spec: UpdateSpec, written: Long, emit: (UpdateState) -> Unit) {
  private val discarded = AtomicBoolean(false)
  private val ended = CountDownLatch(1)

  val reporter = UpdateReporter(spec, written, { if (!isDiscarded) emit(it) })

  val cancel: CancelSignal = CancelSignal { discarded.get() }

  val isDiscarded: Boolean get() = discarded.get()

  /** True for the first discard, false when it was discarded already. */
  fun discard(): Boolean = discarded.compareAndSet(false, true)

  /** Waits up to [millis] for the job to end; true when it did. */
  fun await(millis: Long): Boolean = ended.await(millis, TimeUnit.MILLISECONDS)

  internal fun markEnded() = ended.countDown()
}
