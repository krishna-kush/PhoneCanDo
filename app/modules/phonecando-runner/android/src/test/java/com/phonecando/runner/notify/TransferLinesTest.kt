package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Test

class TransferLinesTest {
  @Test fun aDownloadShowsItsShare() {
    assertEquals("Qwen3.5 4B · downloading 45%", TransferLines.of("Qwen3.5 4B", false, 45, 100))
    assertEquals("Qwen3.5 4B · downloading 100%", TransferLines.of("Qwen3.5 4B", false, 120, 100, "download"))
  }

  @Test fun anImportWithoutATotalShowsItsBytes() {
    assertEquals("model.gguf · importing 1.2 GB", TransferLines.of("model.gguf", true, 1_234_000_000, null))
  }

  @Test fun nothingYetHasNoAmount() {
    assertEquals("Ubuntu 24.04 · downloading", TransferLines.of("Ubuntu 24.04", false, 0, null, "resolve"))
  }

  @Test fun aWaitSaysWhyAndKeepsWhatIsHere() {
    assertEquals("Qwen3.5 4B · 45%, waiting for a network", TransferLines.of("Qwen3.5 4B", false, 45, 100, "offline"))
    assertEquals("Qwen3.5 4B · 45%, trying again in a moment", TransferLines.of("Qwen3.5 4B", false, 45, 100, "retry"))
    assertEquals("Ubuntu 24.04 · waiting for a network", TransferLines.of("Ubuntu 24.04", false, 0, null, "offline"))
  }

  @Test fun aReReadHasNoShare() {
    assertEquals("PhoneCanDo update · checking what an earlier try left", TransferLines.of("PhoneCanDo update", false, 3, 100, "verify"))
  }
}
