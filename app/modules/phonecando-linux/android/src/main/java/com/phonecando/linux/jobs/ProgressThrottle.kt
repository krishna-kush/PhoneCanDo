package com.phonecando.linux.jobs

/**
 * Keeps progress events to a few per second per job: a report passes when
 * its step differs from the last one sent or [intervalMillis] went by.
 * The final event of a job is sent regardless. Pure (the clock is passed in).
 */
class ProgressThrottle(private val intervalMillis: Long = 200, private val now: () -> Long = System::currentTimeMillis) {
  private var lastStep: String? = null
  private var lastAt = Long.MIN_VALUE

  @Synchronized
  fun pass(step: String): Boolean {
    val t = now()
    if (step == lastStep && t - lastAt < intervalMillis) return false
    lastStep = step
    lastAt = t
    return true
  }
}
