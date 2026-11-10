package com.phonecando.runner.notify

import org.junit.Assert.assertEquals
import org.junit.Test

class TransferLinesTest {
  @Test fun aDownloadShowsItsShare() {
    assertEquals("Qwen3.5 4B · downloading 45%", TransferLines.of("Qwen3.5 4B", false, 45, 100))
    assertEquals("Qwen3.5 4B · downloading 100%", TransferLines.of("Qwen3.5 4B", false, 120, 100))
  }

  @Test fun anImportWithoutATotalShowsItsBytes() {
    assertEquals("model.gguf · importing 1.2 GB", TransferLines.of("model.gguf", true, 1_234_000_000, null))
  }
}
