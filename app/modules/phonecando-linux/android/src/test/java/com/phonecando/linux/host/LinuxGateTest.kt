package com.phonecando.linux.host

import com.phonecando.linux.LinuxStatus
import com.phonecando.linux.errors.LinuxError
import com.phonecando.linux.errors.LinuxErrorCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

// JVM checks for the play-channel and missing-payload refusals of every Linux path.
class LinuxGateTest {
  private val lib = "/data/app/x/lib/arm64"

  private fun refusal(block: () -> Unit): LinuxError {
    try {
      block()
    } catch (e: LinuxError) {
      return e
    }
    fail("expected a refusal")
    throw AssertionError()
  }

  @Test fun playRefusesEvenWithEveryFile() {
    val e = refusal { LinuxGate.requireLinux(LinuxStatus.of("play", lib) { true }) }
    assertEquals(LinuxErrorCode.LINUX_UNAVAILABLE, e.code)
    assertTrue(e.message!!, "play" in e.message!!)
  }

  @Test fun fullAndLitePassWithEveryFile() {
    LinuxGate.requireLinux(LinuxStatus.of("full", lib) { true })
    LinuxGate.requireLinux(LinuxStatus.of("lite", lib) { true })
  }

  @Test fun aMissingPayloadRefusesAndNamesIt() {
    val e = refusal { LinuxGate.requireLinux(LinuxStatus.of("full", lib) { !it.endsWith("libproot.so") }) }
    assertEquals(LinuxErrorCode.LINUX_UNAVAILABLE, e.code)
    assertTrue(e.message!!, "libproot.so" in e.message!!)
  }

  @Test fun theDefaultEnvAlsoNeedsTheStagedImage() {
    val ok = LinuxStatus.of("lite", lib) { true }
    LinuxGate.requireDefaultImage(ok, assetPresent = true)
    assertEquals(LinuxErrorCode.LINUX_UNAVAILABLE, refusal { LinuxGate.requireDefaultImage(ok, assetPresent = false) }.code)
    assertEquals(
      LinuxErrorCode.LINUX_UNAVAILABLE,
      refusal { LinuxGate.requireDefaultImage(LinuxStatus.of("play", lib) { true }, assetPresent = true) }.code,
    )
  }
}
