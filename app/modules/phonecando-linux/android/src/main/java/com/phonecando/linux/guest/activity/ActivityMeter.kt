package com.phonecando.linux.guest.activity

import com.phonecando.linux.jobs.ScriptActivity

/** Reads a receive counter: bytes so far, or null when it cannot be read. */
internal fun interface RxCounter {
  fun read(): Long?
}

/** Whether the phone is online now; null when it cannot tell. */
internal fun interface OnlineProbe {
  fun online(): Boolean?
}

/**
 * A guest script's activity since it started: whole seconds on [nowMillis]
 * (a monotonic clock), the bytes [counter] counted meanwhile with their rate
 * (DownloadMeter), and whether [probe] finds the phone online (a download
 * offline just waits, which reads as a hang). The first reading is taken
 * now, as the base. Pure (counter, probe and clock are passed in);
 * synchronized, since the pulse samples while the output thread reads.
 */
internal class ActivityMeter(
  private val counter: RxCounter,
  private val probe: OnlineProbe = OnlineProbe { null },
  private val nowMillis: () -> Long = { System.nanoTime() / 1_000_000 },
) {
  private val meter = DownloadMeter()
  private val startedAt = nowMillis()
  private var online = probe.online()

  init {
    meter.sample(startedAt, counter.read())
  }

  /** Takes one more reading; the pulse calls it once a second. */
  @Synchronized
  fun sample() {
    meter.sample(nowMillis(), counter.read())
    online = probe.online()
  }

  /** Where it stands now: the time from the clock, the rest as of the last reading. */
  @Synchronized
  fun now(): ScriptActivity =
    ScriptActivity((nowMillis() - startedAt).coerceAtLeast(0) / 1000, meter.downloadedBytes, meter.rateBytesPerSec, online)
}
