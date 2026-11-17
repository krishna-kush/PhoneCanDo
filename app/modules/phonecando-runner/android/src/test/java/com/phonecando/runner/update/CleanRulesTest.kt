package com.phonecando.runner.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// When the updates folder is emptied after an install, and what a start
// keeps of it.
class CleanRulesTest {
  private val spec = UpdateSpec(SpecRules.RELEASES + "v1/a.apk", "a.apk", 1_000, "ab".repeat(32), 7, "1.0.1")

  @Test fun theRecordedBuildInstalledCleansUp() {
    assertTrue(CleanRules.afterInstall(7, UpdateRecord(spec, UpdateStep.DONE)))
    // A later build came some other way (Play, adb): the download is old.
    assertTrue(CleanRules.afterInstall(9, UpdateRecord(spec, UpdateStep.DOWNLOAD)))
  }

  @Test fun aNewerDownloadStays() {
    assertFalse(CleanRules.afterInstall(6, UpdateRecord(spec, UpdateStep.DONE)))
    assertFalse(CleanRules.afterInstall(6, UpdateRecord(spec, UpdateStep.FAILED)))
  }

  @Test fun withNoRecordNothingThereIsOurs() {
    // The old JS downloader's APKs, a .part whose record was lost.
    assertTrue(CleanRules.afterInstall(1, null))
  }

  @Test fun aStartKeepsOnlyItsOwnResumablePartial() {
    assertTrue(CleanRules.keptOnStart("a.apk.part", "a.apk", resumable = true))
    assertFalse(CleanRules.keptOnStart("a.apk.part", "a.apk", resumable = false))
    // A finished file with no done record is one we never checked.
    assertFalse(CleanRules.keptOnStart("a.apk", "a.apk", resumable = true))
    assertFalse(CleanRules.keptOnStart("b.apk.part", "a.apk", resumable = true))
    assertFalse(CleanRules.keptOnStart("phonecando-1.0.0-full-arm64.apk", "a.apk", resumable = true))
  }
}
