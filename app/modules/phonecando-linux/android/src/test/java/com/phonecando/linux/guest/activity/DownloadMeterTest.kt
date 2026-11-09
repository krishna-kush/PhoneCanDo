package com.phonecando.linux.guest.activity

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the download count and its smoothed rate.
class DownloadMeterTest {
  @Test fun nothingUntilAReading() {
    val meter = DownloadMeter()
    assertNull(meter.downloadedBytes)
    assertNull(meter.rateBytesPerSec)
  }

  @Test fun theFirstReadingIsTheBase() {
    val meter = DownloadMeter()
    meter.sample(0, 5_000_000)
    assertEquals(0L, meter.downloadedBytes)
    assertEquals(0L, meter.rateBytesPerSec)
  }

  @Test fun bytesCountFromTheBaseAndTheRateSpansTheWindow() {
    val meter = DownloadMeter(windowMillis = 3_000)
    // 1 MB a second for 3 s, then nothing.
    listOf(0L to 0L, 1_000L to 1_000_000L, 2_000L to 2_000_000L, 3_000L to 3_000_000L)
      .forEach { (t, b) -> meter.sample(t, 100 + b) }
    assertEquals(3_000_000L, meter.downloadedBytes)
    assertEquals(1_000_000L, meter.rateBytesPerSec)
    meter.sample(4_000, 100 + 3_000_000)
    // The window is 1 s to 4 s: 2 MB over 3 s.
    assertEquals(666_666L, meter.rateBytesPerSec)
    meter.sample(5_000, 100 + 3_000_000)
    meter.sample(6_000, 100 + 3_000_000)
    assertEquals(0L, meter.rateBytesPerSec)
    assertEquals(3_000_000L, meter.downloadedBytes)
  }

  @Test fun aShortSpanStillGivesARate() {
    val meter = DownloadMeter(windowMillis = 3_000)
    meter.sample(0, 0)
    meter.sample(500, 600_000)
    assertEquals(1_200_000L, meter.rateBytesPerSec)
  }

  @Test fun anUnevenTickKeepsAtLeastTheWindow() {
    val meter = DownloadMeter(windowMillis = 3_000)
    meter.sample(0, 0)
    meter.sample(2_500, 500_000)
    meter.sample(5_000, 3_000_000)
    // The window starts at 2 s; the last reading at or before that is the one at 0 s, so 3 MB over 5 s.
    assertEquals(600_000L, meter.rateBytesPerSec)
  }

  @Test fun aCounterThatGoesBackAddsNothingAndRebases() {
    val meter = DownloadMeter()
    meter.sample(0, 10_000)
    meter.sample(1_000, 30_000)
    meter.sample(2_000, 5_000)
    meter.sample(3_000, 8_000)
    assertEquals(23_000L, meter.downloadedBytes)
  }

  @Test fun anUnreadableCounterIsSkipped() {
    val meter = DownloadMeter()
    meter.sample(0, null)
    assertNull(meter.downloadedBytes)
    meter.sample(1_000, 1_000)
    meter.sample(2_000, null)
    meter.sample(3_000, -1)
    meter.sample(4_000, 4_000)
    assertEquals(3_000L, meter.downloadedBytes)
  }
}
