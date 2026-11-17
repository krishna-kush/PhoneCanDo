package com.phonecando.runner.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

// Which update specs we download: only our own release assets, a plain
// .apk name that stays in the updates folder, a real size and a full sha256.
class SpecRulesTest {
  private val sha = "AB".repeat(32)

  private fun spec(vararg changes: Pair<String, Any?>): Map<String, Any?> = mapOf(
    "url" to SpecRules.RELEASES + "v1.0.1/phonecando-1.0.1-full-arm64.apk",
    "name" to "phonecando-1.0.1-full-arm64.apk",
    "size" to 157_286_400.0,
    "sha256" to sha,
    "versionCode" to 10001.0,
    "version" to "1.0.1",
  ) + changes

  private fun refusal(vararg changes: Pair<String, Any?>): String =
    assertThrows(UpdateSpecException::class.java) { SpecRules.parse(spec(*changes)) }.message!!

  @Test fun ourReleaseAssetParses() {
    val parsed = SpecRules.parse(spec())
    assertEquals("phonecando-1.0.1-full-arm64.apk", parsed.name)
    assertEquals(157_286_400L, parsed.size)
    assertEquals(10001, parsed.versionCode)
    assertEquals("1.0.1", parsed.version)
    // FileDownloader compares lower-case hex.
    assertEquals("ab".repeat(32), parsed.sha256)
  }

  @Test fun onlyOurReleasesAreDownloaded() {
    refusal("url" to "https://example.com/phonecando.apk")
    refusal("url" to "http://github.com/krishna-kush/PhoneCanDo/releases/download/v1/a.apk")
    refusal("url" to "https://github.com/someone/PhoneCanDo/releases/download/v1/a.apk")
    // The prefix must stay the prefix.
    refusal("url" to SpecRules.RELEASES + "../../../../other/repo/releases/download/v1/a.apk")
    refusal("url" to SpecRules.RELEASES + "v1/a b.apk")
  }

  @Test fun theNameIsAPlainApkFile() {
    refusal("name" to "phonecando.zip")
    refusal("name" to ".apk")
    refusal("name" to "../phonecando.apk")
    refusal("name" to "sub/phonecando.apk")
    refusal("name" to "a..b.apk")
  }

  @Test fun theSizeIsAByteCount() {
    refusal("size" to 0.0)
    refusal("size" to -5.0)
    refusal("size" to 10.5)
    refusal("size" to Double.NaN)
  }

  @Test fun theSha256IsFull() {
    refusal("sha256" to "ab".repeat(31))
    refusal("sha256" to "zz".repeat(32))
  }

  @Test fun everyFieldIsThere() {
    for (key in listOf("url", "name", "size", "sha256", "versionCode", "version")) refusal(key to null)
    refusal("versionCode" to 0.0)
    refusal("version" to " ")
  }
}
