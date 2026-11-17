package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TransferLinesTest {
  @Test fun aDownloadShowsItsShare() {
    assertEquals(JobLine("Qwen3.5 4B", "downloading 45%", 0.45), TransferLines.of("Qwen3.5 4B", false, 45, 100))
    assertEquals("Qwen3.5 4B · downloading 100%", TransferLines.of("Qwen3.5 4B", false, 120, 100, "download").line)
  }

  @Test fun anImportWithoutATotalShowsItsBytesUnderARunningBar() {
    assertEquals(JobLine("model.gguf", "importing 1.2 GB", null), TransferLines.of("model.gguf", true, 1_234_000_000, null))
  }

  @Test fun nothingYetHasNoAmount() {
    assertEquals("Ubuntu 24.04 · downloading", TransferLines.of("Ubuntu 24.04", false, 0, null, "resolve").line)
  }

  @Test fun aWaitSaysWhyAndKeepsItsBarWhereItStopped() {
    assertEquals(JobLine("Qwen3.5 4B", "45%, waiting for a network", 0.45), TransferLines.of("Qwen3.5 4B", false, 45, 100, "offline"))
    assertEquals("Qwen3.5 4B · 45%, trying again in a moment", TransferLines.of("Qwen3.5 4B", false, 45, 100, "retry").line)
    assertEquals("Ubuntu 24.04 · waiting for a network", TransferLines.of("Ubuntu 24.04", false, 0, null, "offline").line)
  }

  @Test fun aReReadHasNoShare() {
    val line = TransferLines.of("PhoneCanDo update", false, 3, 100, "verify")
    assertEquals("PhoneCanDo update · checking what an earlier try left", line.line)
    assertNull(line.share)
  }

  @Test fun itsItemHasABarInWholePercent() {
    val item = TransferLines.of("Qwen3.5 4B", false, 459, 1000).item("model:m1", LaunchTarget(LaunchTarget.MODELS, null), "A model coming in")
    assertEquals(ServiceItem("model:m1", "Qwen3.5 4B", listOf("downloading 45%"), "A model coming in", LaunchTarget("models", null), ServiceItem.Bar(45)), item)
    assertEquals(ServiceItem.Bar(null), TransferLines.of("x", true, 5, null).item("k", null, "p").bar)
  }
}
