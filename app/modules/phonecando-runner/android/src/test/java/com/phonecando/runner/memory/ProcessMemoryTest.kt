package com.phonecando.runner.memory

import com.phonecando.runner.engine.proc.ProcEntry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File
import java.nio.file.Files

// Per-process memory: the two files it reads, the sums per owner, and a
// read over a folder laid out like /proc.
class ProcessMemoryTest {
  private val me = 4242
  private val uid = 10123
  private val tag = "model-server"

  private val rollup = """
    55d0a000-7ffd1000 ---p 00000000 00:00 0                                  [rollup]
    Rss:              204800 kB
    Pss:              150000 kB
    Pss_Anon:         120000 kB
    Pss_File:          30000 kB
  """.trimIndent()

  @Test fun readsPssAndRss() {
    assertEquals(150_000L * 1024, ProcessMemory.pssBytes(rollup))
    assertNull(ProcessMemory.pssBytes("Rss: 1 kB\nPss_Anon: 2 kB\n"))
    assertEquals(9_876L * 1024, ProcessMemory.rssBytes("Name:\tx\nVmPeak:\t 20000 kB\nVmRSS:\t    9876 kB\n"))
    assertNull(ProcessMemory.rssBytes("Name:\tx\n"))
    assertNull(ProcessMemory.rssBytes("VmRSS:\tlots kB\n"))
  }

  @Test fun sumsPerAgentAndPerModel() {
    val entries = listOf(
      ProcEntry(100, uid, false, "a1"), // the engine
      ProcEntry(101, uid, false, "a1"), // its proot
      ProcEntry(102, uid, false, "a2"),
      ProcEntry(103, uid, false, tag, "qwen"),
      ProcEntry(104, uid, false, tag, "gemma"),
      ProcEntry(105, uid, false, tag, null), // a server of unknown model: not counted
      ProcEntry(106, uid, false, null), // untagged
      ProcEntry(107, 10999, false, "a1"), // another app
      ProcEntry(108, uid, true, "a1"), // a zombie
      ProcEntry(me, uid, false, "a1"), // ourselves
      ProcEntry(109, uid, false, "a2"), // gone before its read
    )
    val bytes = mapOf(100 to 10L, 101 to 5L, 102 to 7L, 103 to 1_000L, 104 to 2_000L, 105 to 9L, 107 to 1L, 108 to 1L, me to 1L)
    val owners = ProcessMemory.group(entries, me, uid, tag) { bytes[it] }
    assertEquals(mapOf("a1" to 15L, "a2" to 7L), owners.agents)
    assertEquals(mapOf("qwen" to 1_000L, "gemma" to 2_000L), owners.models)
  }

  private val proc = Files.createTempDirectory("proc").toFile()

  @After fun cleanup() {
    proc.deleteRecursively()
  }

  @Test fun readsAProcFolder() {
    File(proc, "300").apply { mkdirs() }.let {
      File(it, "smaps_rollup").writeText(rollup)
      File(it, "status").writeText("VmRSS:\t1 kB\n")
    }
    // No smaps_rollup (an older kernel): VmRSS.
    File(proc, "301").apply { mkdirs() }.let { File(it, "status").writeText("VmRSS:\t2048 kB\n") }
    val memory = ProcessMemory(proc)
    assertEquals(150_000L * 1024, memory.bytes(300))
    assertEquals(2_048L * 1024, memory.bytes(301))
    assertNull(memory.bytes(302))
    val owners = memory.read(listOf(ProcEntry(300, uid, false, "a1"), ProcEntry(301, uid, false, tag, "qwen")), me, uid, tag)
    assertEquals(mapOf("a1" to 150_000L * 1024), owners.agents)
    assertEquals(mapOf("qwen" to 2_048L * 1024), owners.models)
  }
}
