package com.phonecando.linux.errors

import com.phonecando.lre.api.LreException
import com.phonecando.network.NetException
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.IOException

// JVM checks for the stable error codes JS sees.
class LinuxErrorCodeTest {
  private val samples: Map<LreException, String> = mapOf(
    LreException.UnsafeEntry("../x", "escapes") to "unsafe_entry",
    LreException.TooLarge("layer", 10) to "too_large",
    LreException.InvalidRef("Bad Ref", "contains spaces") to "invalid_ref",
    LreException.NoSpace(10, 1) to "no_space",
    LreException.DigestMismatch("sha256:a", "sha256:b") to "digest_mismatch",
    LreException.Network("https://registry", 503) to "network",
    LreException.RateLimited("https://registry") to "rate_limited",
    LreException.NotFound("image") to "not_found",
    LreException.NoArm64("alpine") to "no_arm64",
    LreException.UnsupportedLayer("application/x-foreign") to "unsupported_layer",
    LreException.UnsupportedManifest("schema1") to "unsupported_manifest",
    LreException.NoShell() to "no_shell",
    LreException.Corrupt("run/image.properties") to "corrupt",
    LreException.Cancelled() to "cancelled",
  )

  @Test fun everyRuntimeFailureHasItsCode() {
    samples.forEach { (e, code) -> assertEquals(e.javaClass.simpleName, code, LinuxErrorCode.of(e).code) }
  }

  @Test fun theSamplesCoverEverySubclass() {
    val subclasses = LreException::class.java.declaredClasses.filter { LreException::class.java.isAssignableFrom(it) }.toSet()
    assertEquals(subclasses, samples.keys.map { it.javaClass }.toSet())
  }

  @Test fun ourOwnFailuresKeepTheirCode() {
    listOf(
      LinuxErrorCode.LINUX_UNAVAILABLE,
      LinuxErrorCode.ENV_IN_USE,
      LinuxErrorCode.BUSY,
      LinuxErrorCode.COMMAND_FAILED,
      LinuxErrorCode.TIMED_OUT,
    ).forEach {
      assertEquals(it, LinuxErrorCode.of(LinuxError(it, "why")))
    }
  }

  // A download's wait that a cancel cut short ends with network's own error.
  @Test fun aNetworkFailureGetsTheRuntimesCode() {
    assertEquals(LinuxErrorCode.CANCELLED, LinuxErrorCode.of(NetException.Cancelled()))
    assertEquals(LinuxErrorCode.RATE_LIMITED, LinuxErrorCode.of(NetException.RateLimited("https://registry", 30)))
    assertEquals("cancelled: cancelled", LinuxErrorCode.lineOf(NetException.Cancelled()))
  }

  @Test fun aFullDiskIsNoSpaceAndAnythingElseInternal() {
    assertEquals(LinuxErrorCode.NO_SPACE, LinuxErrorCode.of(IOException("write failed: ENOSPC (No space left on device)")))
    assertEquals(LinuxErrorCode.INTERNAL, LinuxErrorCode.of(IOException("EACCES")))
    assertEquals(LinuxErrorCode.INTERNAL, LinuxErrorCode.of(IllegalStateException()))
    assertEquals(LinuxErrorCode.CANCELLED, LinuxErrorCode.of(InterruptedException()))
  }

  @Test fun codesAreUniqueSnakeCaseAndFindable() {
    val codes = LinuxErrorCode.entries.map { it.code }
    assertEquals(codes.size, codes.toSet().size)
    codes.forEach { assertEquals(it, Regex("[a-z0-9_]+").matches(it), true) }
    LinuxErrorCode.entries.forEach { assertEquals(it, LinuxErrorCode.fromCode(it.code)) }
  }

  @Test fun theMessageIsTheFailuresOwnLine() {
    assertEquals("needs 10 bytes, 1 free", LinuxErrorCode.messageOf(LreException.NoSpace(10, 1)))
    assertEquals("IllegalStateException", LinuxErrorCode.messageOf(IllegalStateException()))
  }

  // JS reads the code back out of a record's or event's line (codeOfText): the code, then ": ".
  @Test fun aRecordLineHasTheCodeFirst() {
    assertEquals("no_space: needs 10 bytes, 1 free", LinuxErrorCode.lineOf(LreException.NoSpace(10, 1)))
    assertEquals("internal: IllegalStateException", LinuxErrorCode.lineOf(IllegalStateException()))
    samples.forEach { (e, code) -> assertEquals(true, LinuxErrorCode.lineOf(e).startsWith("$code: ")) }
    assertEquals("busy: why", LinuxErrorCode.lineOf(LinuxError(LinuxErrorCode.BUSY, "why")))
  }
}
