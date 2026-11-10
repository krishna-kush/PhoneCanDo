package com.phonecando.models.jobs

/**
 * Bytes per second over the last [windowMillis] of a transfer's progress:
 * what the user sees next to a download. Null until the samples span at
 * least [minSpanMillis] (one sample says nothing). Pure (the clock is passed
 * in).
 */
class RateMeter(
  private val windowMillis: Long = 5_000,
  private val minSpanMillis: Long = 500,
  private val now: () -> Long = System::currentTimeMillis,
) {
  private val samples = ArrayDeque<Pair<Long, Long>>()

  /** Adds the transfer's byte count now; returns the rate. A count that went back starts over. */
  @Synchronized
  fun add(bytes: Long): Long? {
    val t = now()
    if (samples.isNotEmpty() && bytes < samples.last().second) samples.clear()
    samples.addLast(t to bytes)
    // Samples older than the window go; the last two always stay.
    while (samples.size > 2 && t - samples.first().first >= windowMillis) samples.removeFirst()
    return rate()
  }

  @Synchronized
  fun reset() = samples.clear()

  private fun rate(): Long? {
    if (samples.size < 2) return null
    val (t0, b0) = samples.first()
    val (t1, b1) = samples.last()
    val span = t1 - t0
    if (span < minSpanMillis) return null
    return (b1 - b0) * 1000 / span
  }
}
