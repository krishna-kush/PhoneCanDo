package com.phonecando.runner.engine.proc

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File
import java.nio.file.Files

// JVM checks for finding an agent's processes: environ and status parsing,
// the pid selection, and a scan over a folder laid out like /proc.
class TaggedProcessesTest {
  private val me = 4242
  private val uid = 10123

  private fun environ(vararg entries: String) = entries.joinToString("\u0000", postfix = "\u0000").toByteArray()

  @Test fun parsesEnviron() {
    val env = TaggedProcesses.parseEnviron(environ("HOME=/h", "PHONECANDO_AGENT=a1", "X=a=b", "NOEQ", "=v", "HOME=/second"))
    assertEquals(mapOf("HOME" to "/h", "PHONECANDO_AGENT" to "a1", "X" to "a=b"), env)
    assertEquals("a1", TaggedProcesses.tagOf(environ("A=1", "PHONECANDO_AGENT=a1")))
    assertNull(TaggedProcesses.tagOf(environ("A=1")))
    assertNull(TaggedProcesses.tagOf(ByteArray(0)))
    // No trailing NUL (a truncated read) still parses the last entry.
    assertEquals("a2", TaggedProcesses.tagOf("A=1\u0000PHONECANDO_AGENT=a2".toByteArray()))
  }

  @Test fun parsesStatus() {
    assertEquals(uid to false, TaggedProcesses.parseStatus("Name:\tx\nState:\tS (sleeping)\nUid:\t$uid\t$uid\t$uid\t$uid\n"))
    assertEquals(uid to true, TaggedProcesses.parseStatus("State:\tZ (zombie)\nUid:\t$uid\t0\t0\t0\n"))
    assertNull(TaggedProcesses.parseStatus("Name:\tx\n"))
  }

  @Test fun selectsOurTaggedLiveProcessesOnly() {
    val entries = listOf(
      ProcEntry(100, uid, false, "a1"), // the engine
      ProcEntry(101, uid, false, "a1"), // its shell
      ProcEntry(102, uid, false, "a2"), // another agent
      ProcEntry(103, uid, false, null), // untagged: the TUI, a helper
      ProcEntry(104, 10999, false, "a1"), // another app
      ProcEntry(105, uid, true, "a1"), // a zombie
      ProcEntry(me, uid, false, "a1"), // ourselves, however tagged
      ProcEntry(106, uid, false, ""),
    )
    assertEquals(listOf(100, 101), TaggedProcesses.select(entries, setOf("a1"), me, uid))
    assertEquals(listOf(100, 101, 102), TaggedProcesses.select(entries, null, me, uid))
    assertEquals(listOf(102), TaggedProcesses.select(entries, setOf("a2", "gone"), me, uid))
  }

  private val proc = Files.createTempDirectory("proc").toFile()

  @After fun cleanup() {
    proc.deleteRecursively()
  }

  private fun fake(pid: String, owner: Int, state: String, env: ByteArray?) {
    val dir = File(proc, pid).apply { mkdirs() }
    File(dir, "status").writeText("Name:\tx\nState:\t$state\nUid:\t$owner\t$owner\t$owner\t$owner\n")
    if (env != null) File(dir, "environ").writeBytes(env)
  }

  @Test fun scansAProcFolder() {
    fake("200", uid, "S (sleeping)", environ("PHONECANDO_AGENT=a1"))
    fake("201", 10999, "S (sleeping)", environ("PHONECANDO_AGENT=a1"))
    fake("202", uid, "R (running)", null) // environ unreadable
    fake("203", uid, "Z (zombie)", environ("PHONECANDO_AGENT=a1"))
    File(proc, "self").mkdirs()
    File(proc, "meminfo").writeText("x")
    val entries = ProcScanner(proc).scan(uid).sortedBy { it.pid }
    assertEquals(
      listOf(
        ProcEntry(200, uid, false, "a1"),
        // Another uid's environ is never read.
        ProcEntry(201, 10999, false, null),
        ProcEntry(202, uid, false, null),
        ProcEntry(203, uid, true, null),
      ),
      entries,
    )
    assertEquals(listOf(200), TaggedProcesses.select(entries, setOf("a1"), me, uid))
  }
}
