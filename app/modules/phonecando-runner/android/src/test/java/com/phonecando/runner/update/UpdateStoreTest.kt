package com.phonecando.runner.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File
import java.nio.file.Files

// The record on disk: what goes in comes back, and a file that does not
// read, or holds a spec we would refuse, is no record.
class UpdateStoreTest {
  private val file = File(Files.createTempDirectory("update").toFile(), "state/update-download.json")
  private val store = UpdateStore(file)
  private val spec = UpdateSpec(SpecRules.RELEASES + "v1/a.apk", "a.apk", 157_286_400, "ab".repeat(32), 7, "1.0.1")

  @Test fun aRecordComesBack() {
    store.save(UpdateRecord(spec, UpdateStep.DOWNLOAD))
    assertEquals(UpdateRecord(spec, UpdateStep.DOWNLOAD), store.load())
    val failed = UpdateRecord(spec, UpdateStep.FAILED, "network: network error on x", "network")
    store.save(failed)
    assertEquals(failed, store.load())
    store.delete()
    assertNull(store.load())
  }

  @Test fun aFileThatDoesNotReadIsNoRecord() {
    file.parentFile!!.mkdirs()
    file.writeText("{not json")
    assertNull(store.load())
    file.writeText("""{"url":"https://example.com/a.apk","name":"a.apk","size":1,"sha256":"${"ab".repeat(32)}","versionCode":7,"version":"1","step":"done"}""")
    assertNull(store.load())
    store.save(UpdateRecord(spec, UpdateStep.DONE))
    file.writeText(file.readText().replace("\"done\"", "\"paused\""))
    assertNull(store.load())
  }
}
