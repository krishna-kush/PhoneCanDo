package com.phonecando.linux.images

import com.phonecando.lre.image.setup.SetupStep
import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink

/**
 * Passes image setup progress on and remembers the last setup step it saw,
 * so a failed create can name the step that failed. ImageSetup announces
 * each step before running it as `(step, ordinal, step count)`; JS reads
 * done/total as progress within the step, so we pass that announcement on
 * as the step's start `(step, 0, null)`. Later reports of the step (the
 * unpacked bytes) pass as they are. Pure.
 */
class SetupStepTracker(private val inner: ProgressSink) : ProgressSink {
  @Volatile
  var step: String? = null
    private set

  override fun report(progress: Progress) {
    if (progress.step !in IDS) return inner.report(progress)
    val starts = progress.step != step
    step = progress.step
    inner.report(if (starts) Progress(progress.step, 0, null) else progress)
  }

  private companion object {
    val IDS = SetupStep.entries.map { it.id }.toSet()
  }
}
