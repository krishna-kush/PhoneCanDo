package com.phonecando.runner.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// How network's steps and a record on disk read for JS: the state map's
// step, bytes and path, done only while the finished APK is there whole.
class UpdateStateTest {
  private val spec = UpdateSpec(SpecRules.RELEASES + "v1/a.apk", "a.apk", 1_000, "ab".repeat(32), 7, "1.0.1")
  private val path = "/data/files/updates/a.apk"

  @Test fun networkStepsMapToOurs() {
    assertEquals(UpdateStep.VERIFY, UpdateStep.ofProgress("verify"))
    assertEquals(UpdateStep.DOWNLOAD, UpdateStep.ofProgress("download"))
    // A step network adds later still counts as bytes coming in.
    assertEquals(UpdateStep.DOWNLOAD, UpdateStep.ofProgress("unpack"))
    assertEquals(UpdateStep.OFFLINE, UpdateStep.of("offline"))
    assertNull(UpdateStep.of("paused"))
  }

  @Test fun aDoneRecordCountsOnlyWithItsWholeApk() {
    val done = UpdateRecord(spec, UpdateStep.DONE)
    assertEquals(UpdateState(spec, UpdateStep.DONE, 1_000, path), UpdateState.ofRecord(done, path, 1_000, 0))
    assertNull(UpdateState.ofRecord(done, path, null, 0))
    assertNull(UpdateState.ofRecord(done, path, 999, 0))
  }

  @Test fun aFailedRecordKeepsItsErrorAndPartial() {
    val failed = UpdateRecord(spec, UpdateStep.FAILED, "network: network error on x", "network")
    val state = UpdateState.ofRecord(failed, path, null, 400)!!
    assertEquals(UpdateStep.FAILED, state.step)
    assertEquals(400L, state.written)
    assertNull(state.path)
    assertEquals("network", state.errorCode)
  }

  @Test fun aRecordLeftRunningIsStopped() {
    // Its process died and nothing resumed it: the next start goes on from the .part.
    val state = UpdateState.ofRecord(UpdateRecord(spec, UpdateStep.DOWNLOAD), path, null, 250)!!
    assertEquals(UpdateStep.STOPPED, state.step)
    assertEquals(250L, state.written)
  }

  @Test fun theMapIsTheContract() {
    val map = UpdateState(spec, UpdateStep.RETRY, 500).toMap()
    assertEquals(
      mapOf(
        "version" to "1.0.1", "versionCode" to 7, "name" to "a.apk", "path" to null, "step" to "retry",
        "written" to 500.0, "total" to 1_000.0, "error" to null, "errorCode" to null,
      ),
      map,
    )
  }
}
