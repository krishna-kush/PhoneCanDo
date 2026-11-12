package com.phonecando.runner.engine.proc

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths

// JVM checks for reading our processes for job detection: the stat,
// status, cmdline, io and fdinfo parsers, what stdin points at, and a scan
// over a folder laid out like /proc (fd links as symlinks).
class DetailScannerTest {
  private val uid = 10123
  private val me = 4242
  private val proc: File = Files.createTempDirectory("proc").toFile()

  @After fun cleanUp() {
    proc.deleteRecursively()
  }

  @Test fun parsesStatEvenWithParensInTheName() {
    // pid (comm) state ppid pgrp session tty tpgid flags minflt cminflt majflt cmajflt utime stime cutime cstime prio nice threads itreal starttime
    val stat = "1234 (a (b) c) S 77 1234 1234 0 -1 4194560 10 0 0 0 150 50 7 3 20 0 1 0 98765 1000 200"
    assertEquals(ProcFields.Stat(ppid = 77, startTicks = 98765, cpuTicks = 210), ProcFields.parseStat(stat))
    assertNull(ProcFields.parseStat("garbage"))
    assertNull(ProcFields.parseStat("1 (x) S 1 2"))
  }

  @Test fun parsesTracerNameCmdlineAndIo() {
    assertEquals(321 to "bash", ProcFields.parseTracer("Name:\tbash\nState:\tS\nTracerPid:\t321\nUid:\t1\t1\t1\t1\n"))
    assertEquals(0 to null, ProcFields.parseTracer("State:\tS\n"))
    assertEquals(listOf("npm", "run", "dev"), ProcFields.parseCmdline("npm\u0000run\u0000dev\u0000".toByteArray()))
    assertEquals(emptyList<String>(), ProcFields.parseCmdline(ByteArray(0)))
    assertEquals(3000L, ProcFields.parseIo("rchar: 1000\nwchar: 2000\nsyscr: 5\nread_bytes: 4096\n"))
    assertNull(ProcFields.parseIo(""))
  }

  @Test fun fdinfoWritesOnlyWhenOpenForWriting() {
    assertTrue(ProcFields.writes("pos:\t0\nflags:\t01\nmnt_id:\t15\n"))
    assertTrue(ProcFields.writes("pos:\t0\nflags:\t02000002\n"))
    assertFalse(ProcFields.writes("pos:\t0\nflags:\t02000000\n"))
    assertFalse(ProcFields.writes("pos:\t0\n"))
  }

  @Test fun stdinKinds() {
    assertEquals(Stdin(Stdin.Kind.NULL), Stdin.of("/dev/null"))
    assertEquals(Stdin(Stdin.Kind.TTY), Stdin.of("/dev/pts/3"))
    assertEquals(Stdin(Stdin.Kind.PIPE, 4567), Stdin.of("pipe:[4567]"))
    assertEquals(Stdin(Stdin.Kind.SOCKET, 89), Stdin.of("socket:[89]"))
    assertEquals(Stdin(Stdin.Kind.FILE), Stdin.of("/data/data/x/files/log.txt"))
    assertEquals(Stdin(Stdin.Kind.OTHER), Stdin.of("anon_inode:[eventpoll]"))
  }

  private fun fake(
    pid: Int,
    owner: Int = uid,
    state: String = "S (sleeping)",
    tracer: Int = 0,
    ppid: Int = 1,
    startTicks: Long = 1000,
    cpuTicks: Long = 0,
    env: String? = "PHONECANDO_AGENT=a1",
    argv: List<String> = listOf("node", "server.js"),
    stdin: String? = "/dev/null",
    fds: Map<Int, Pair<String, Int>> = emptyMap(),
  ) {
    val dir = File(proc, "$pid").apply { mkdirs() }
    File(dir, "status").writeText("Name:\t${argv.firstOrNull() ?: "x"}\nState:\t$state\nTracerPid:\t$tracer\nUid:\t$owner\t$owner\t$owner\t$owner\n")
    File(dir, "stat").writeText("$pid (x) S $ppid $pid $pid 0 -1 0 0 0 0 0 $cpuTicks 0 0 0 20 0 1 0 $startTicks 1000 200")
    if (env != null) File(dir, "environ").writeBytes((env + "\u0000").toByteArray())
    File(dir, "cmdline").writeBytes(argv.joinToString("\u0000", postfix = "\u0000").toByteArray())
    val fd = File(dir, "fd").apply { mkdirs() }
    val fdinfo = File(dir, "fdinfo").apply { mkdirs() }
    if (stdin != null) Files.createSymbolicLink(File(fd, "0").toPath(), Paths.get(stdin))
    for ((n, link) in fds) {
      Files.createSymbolicLink(File(fd, "$n").toPath(), Paths.get(link.first))
      File(fdinfo, "$n").writeText("pos:\t0\nflags:\t0${link.second}\n")
    }
  }

  @Test fun scansOurLiveProcessesWithEpochStarts() {
    fake(200, startTicks = 5000, cpuTicks = 250, argv = listOf("claude"), stdin = "/dev/pts/0")
    fake(201, ppid = 200, startTicks = 6000, stdin = "pipe:[77]", tracer = 150)
    fake(202, owner = 10999)
    fake(203, state = "Z (zombie)")
    fake(me)
    fake(204, stdin = null, env = null)
    File(proc, "self").mkdirs()
    // Boot was 1_000_000 ms of wall clock ago: a start at 5000 ticks (50 s) is wall 1_000_000 + 50_000.
    val scanner = DetailScanner(proc, hz = 100, sinceBoot = { 1_000_000L }, wall = { 2_000_000L })
    val found = scanner.scan(uid, me).sortedBy { it.pid }
    assertEquals(listOf(200, 201, 204), found.map { it.pid })
    val engine = found[0]
    assertEquals(1_050_000L, engine.startedAt)
    assertEquals(2500L, engine.cpuMs)
    assertEquals("a1", engine.tag)
    assertEquals(listOf("claude"), engine.argv)
    assertEquals(Stdin.Kind.TTY, engine.stdin.kind)
    val helper = found[1]
    assertEquals(200, helper.ppid)
    assertEquals(150, helper.tracerPid)
    assertEquals(Stdin(Stdin.Kind.PIPE, 77), helper.stdin)
    // No fd 0 in a folder we can list: closed; no environ: untagged.
    assertEquals(Stdin.NONE, found[2].stdin)
    assertNull(found[2].tag)
  }

  @Test fun findsWhoWritesAPipe() {
    fake(300, fds = mapOf(5 to ("pipe:[77]" to 1), 6 to ("pipe:[78]" to 0), 7 to ("socket:[9]" to 2)))
    fake(301, fds = mapOf(3 to ("pipe:[77]" to 0)))
    val scanner = DetailScanner(proc, sinceBoot = { 0L })
    assertEquals(mapOf(77L to setOf(300)), scanner.pipeWriters(listOf(300, 301), setOf(77L, 78L)))
    assertEquals(emptyMap<Long, Set<Int>>(), scanner.pipeWriters(listOf(300), emptySet()))
    // No fd folder could be read: unknown.
    assertNull(scanner.pipeWriters(listOf(999), setOf(77L)))
  }
}
