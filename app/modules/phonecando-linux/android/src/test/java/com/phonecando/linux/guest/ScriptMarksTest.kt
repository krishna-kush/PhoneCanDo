package com.phonecando.linux.guest

import com.phonecando.linux.jobs.ScriptRetry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the marker lines an install script prints: `@phase` and `@retry`.
class ScriptMarksTest {
  @Test fun onlyAWholePhaseLineCounts() {
    assertEquals("install", ScriptMarks.phaseOf("@phase install"))
    assertEquals("runtime:node", ScriptMarks.phaseOf("@phase\truntime:node "))
    listOf("echo @phase x", "@phase", "@phase two words", "@phases x", "@phase ../x", "@phase " + "a".repeat(65))
      .forEach { assertNull(it, ScriptMarks.phaseOf(it)) }
  }

  @Test fun aRetryLineGivesItsTryAndMost() {
    assertEquals(ScriptRetry(2, 3), ScriptMarks.retryOf("@retry install 2/3"))
    assertEquals(ScriptRetry(1, 1), ScriptMarks.retryOf("@retry\truntime:node\t1/1 "))
    assertEquals(ScriptRetry(10, 120), ScriptMarks.retryOf("@retry packages 10/120"))
  }

  @Test fun onlyAWholeSaneRetryLineCounts() {
    listOf(
      "echo @retry install 2/3", "@retry install", "@retry 2/3", "@retry install 2 / 3", "@retry install two/3",
      "@retry install 0/3", "@retry install 4/3", "@retry install 2/0", "@retry install 1000/1000",
      "@retry ../x 2/3", "@retry install 2/3 more", "@retries install 2/3",
    ).forEach { assertNull(it, ScriptMarks.retryOf(it)) }
  }

  @Test fun aPhaseLineIsNoRetryAndBack() {
    assertNull(ScriptMarks.retryOf("@phase install"))
    assertNull(ScriptMarks.phaseOf("@retry install 2/3"))
  }
}
