package com.phonecando.linux.records

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

// JVM checks for the write-through record store and its atomic file.
class LinuxRecordsTest {
  @get:Rule val tmp = TemporaryFolder()

  @Test fun aChangeIsOnDiskForTheNextProcess() {
    val dir = File(tmp.root, "state")
    LinuxRecords(dir).transact {
      putEnv(Samples.envs[0])
      putImage(Samples.images[0])
    }
    val again = LinuxRecords(dir)
    assertEquals(listOf(Samples.envs[0]), again.envs())
    assertEquals(listOf(Samples.images[0]), again.images())
    assertEquals(setOf("envs.json", "images.json"), dir.list()!!.toSet())
  }

  @Test fun onChangedRunsOnlyWhenSomethingChanged() {
    var calls = 0
    val records = LinuxRecords(tmp.root) { calls++ }
    records.transact { putEnv(Samples.envs[2]) }
    records.transact { env("android") }
    records.transact { putEnv(Samples.envs[2]) }
    assertEquals(1, calls)
  }

  @Test fun aReplacedRecordKeepsItsPlace() {
    val records = LinuxRecords(tmp.root)
    records.transact { Samples.envs.forEach(::putEnv) }
    records.transact { updateEnv("k3x9qa") { it.copy(state = EnvState.READY) } }
    assertEquals(listOf("default", "k3x9qa", "android"), records.envs().map { it.id })
    assertEquals(EnvState.READY, records.env("k3x9qa")!!.state)
  }

  @Test fun aFailedTransactionChangesNothing() {
    val records = LinuxRecords(tmp.root)
    records.transact { putImage(Samples.images[0]) }
    try {
      records.transact {
        removeImage(Samples.images[0].id)
        throw IllegalStateException("refused")
      }
    } catch (_: IllegalStateException) {
    }
    assertEquals(listOf(Samples.images[0]), records.images())
    assertEquals(listOf(Samples.images[0]), LinuxRecords(tmp.root).images())
  }

  @Test fun aCorruptFileIsMovedAsideAndWeStartEmpty() {
    File(tmp.root, "envs.json").writeText("{not json")
    val records = LinuxRecords(tmp.root)
    assertEquals(emptyList<EnvRecord>(), records.envs())
    assertTrue(File(tmp.root, "envs.json.corrupt").isFile)
    assertFalse(File(tmp.root, "envs.json").exists())
  }

  @Test fun aWriteReplacesTheFileWholeAndLeavesNoTemp() {
    val file = RecordFile(File(tmp.root, "x/state.json"))
    file.write("first")
    file.write("second")
    assertEquals("second", file.read())
    assertEquals(listOf("state.json"), File(tmp.root, "x").list()!!.toList())
  }
}
