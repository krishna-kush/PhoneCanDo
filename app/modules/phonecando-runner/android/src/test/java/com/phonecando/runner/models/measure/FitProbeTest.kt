package com.phonecando.runner.models.measure

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

// The dry run read line by line and stopped once it said what we need,
// long before it would load the model (here: a shell that sleeps on).
// The sleep is exec'd, as the server is one process: a shell that forks
// it (dash, CI's /bin/sh) leaves it holding stdout after the kill.
class FitProbeTest {
  @get:Rule val tmp = TemporaryFolder()

  private fun sh(script: String) = listOf("/bin/sh", "-c", script)

  private fun probe(script: String, timeoutMs: Long = 10_000) =
    FitProbe.run(sh(script), mapOf("PATH" to "/usr/bin:/bin"), tmp.root, timeoutMs) { line -> line.removePrefix("got ").takeIf { line.startsWith("got ") } }

  @Test fun itStopsOnceTheLineCame() {
    val started = System.nanoTime()
    assertEquals("it", probe("echo starting; echo 'got it'; exec sleep 30"))
    assertTrue((System.nanoTime() - started) / 1_000_000 < 5_000)
  }

  @Test fun anEndWithoutItOrATimeoutIsNone() {
    assertNull(probe("echo nothing"))
    val started = System.nanoTime()
    assertNull(probe("exec sleep 30", timeoutMs = 300))
    assertTrue((System.nanoTime() - started) / 1_000_000 < 5_000)
  }

  @Test fun itSeesOnlyTheEnvGiven() {
    assertEquals("only", FitProbe.run(sh("echo \"got \$ONLY\""), mapOf("ONLY" to "only"), tmp.root) { it.removePrefix("got ").takeIf { _ -> it.startsWith("got ") } })
  }
}
