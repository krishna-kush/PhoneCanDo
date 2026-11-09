package com.phonecando.linux.guest.activity

/**
 * Turns readings of a receive counter into bytes received since the first
 * reading and a rate smoothed over the last [windowMillis]. The counter is
 * the whole app's, so it only ever counts up from a run's start: a reading
 * below the one before (the counter was reset) adds nothing and becomes
 * the new base. A reading Android cannot give (null) is skipped. Pure; the
 * caller passes the time and synchronizes.
 */
internal class DownloadMeter(private val windowMillis: Long = WINDOW_MS) {
  private var lastRaw: Long? = null
  private var downloaded = 0L

  // (time, downloaded) readings, oldest first: one at or before the window's start, then the window.
  private val readings = ArrayDeque<Pair<Long, Long>>()

  /** Takes one reading of the counter at [atMillis]; null (Android cannot count) is skipped. */
  fun sample(atMillis: Long, rxBytes: Long?) {
    if (rxBytes == null || rxBytes < 0) return
    val before = lastRaw
    lastRaw = rxBytes
    if (before != null && rxBytes > before) downloaded += rxBytes - before
    readings.addLast(atMillis to downloaded)
    while (readings.size > 1 && readings[1].first <= atMillis - windowMillis) readings.removeFirst()
  }

  /** Bytes received since the first reading; null until a reading came. */
  val downloadedBytes: Long?
    get() = if (lastRaw == null) null else downloaded

  /** Bytes per second over the window; 0 with one reading, null until a reading came. */
  val rateBytesPerSec: Long?
    get() {
      if (lastRaw == null) return null
      val (t0, b0) = readings.first()
      val (t1, b1) = readings.last()
      val span = t1 - t0
      return if (span <= 0) 0 else (b1 - b0) * 1000 / span
    }

  companion object {
    /** The rate's span: smooth enough to read, quick enough to show a stall. */
    const val WINDOW_MS = 3_000L
  }
}
