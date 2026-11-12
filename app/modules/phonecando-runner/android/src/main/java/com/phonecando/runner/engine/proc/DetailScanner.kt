package com.phonecando.runner.engine.proc

import java.io.File
import java.nio.file.Files

// Reads our own processes in /proc for job detection (engine/work/): for
// each live process of [myUid] but ours, its parent, start, agent tag,
// tracer, command line, stdin, CPU and I/O (ProcDetail). Heavier than
// ProcScanner, which the reaper polls; this runs every few seconds at
// most. A process start is clock ticks since boot ([hz] a second); it
// becomes epoch ms through [sinceBoot] (SystemClock.elapsedRealtime on the
// phone) and [wall]. Entries that vanish mid-read are skipped, files that
// cannot be read leave their fields empty. Pure JVM; the root is a
// parameter so tests can hand it a folder.
class DetailScanner(
  private val root: File = File("/proc"),
  private val hz: Long = 100L,
  private val sinceBoot: () -> Long,
  private val wall: () -> Long = System::currentTimeMillis,
) {
  fun scan(myUid: Int, myPid: Int): List<ProcDetail> {
    val names = root.list() ?: return emptyList()
    val bootToWall = wall() - sinceBoot()
    val out = ArrayList<ProcDetail>()
    for (name in names) {
      val pid = name.toIntOrNull() ?: continue
      if (pid == myPid) continue
      read(File(root, name), pid, myUid, bootToWall)?.let(out::add)
    }
    return out
  }

  private fun read(dir: File, pid: Int, myUid: Int, bootToWall: Long): ProcDetail? {
    val status = text(File(dir, "status")) ?: return null
    val (uid, zombie) = TaggedProcesses.parseStatus(status) ?: return null
    if (uid != myUid || zombie) return null
    val stat = text(File(dir, "stat"))?.let(ProcFields::parseStat) ?: return null
    val (tracer, name) = ProcFields.parseTracer(status)
    val tag = bytes(File(dir, "environ"))?.let(TaggedProcesses::tagOf)
    return ProcDetail(
      pid = pid,
      ppid = stat.ppid,
      startedAt = bootToWall + stat.startTicks * 1000L / hz,
      tag = tag,
      tracerPid = tracer,
      name = name,
      argv = bytes(File(dir, "cmdline"))?.let(ProcFields::parseCmdline).orEmpty(),
      stdin = stdin(File(dir, "fd")),
      cpuMs = stat.cpuTicks * 1000L / hz,
      ioBytes = text(File(dir, "io"))?.let(ProcFields::parseIo),
      startTicks = stat.startTicks,
    )
  }

  /**
   * For each pipe inode in [inodes], which of [pids] hold it open for
   * writing; null when none of their fd folders could be read.
   */
  fun pipeWriters(pids: Collection<Int>, inodes: Set<Long>): Map<Long, Set<Int>>? {
    if (inodes.isEmpty()) return emptyMap()
    var readable = false
    val out = HashMap<Long, MutableSet<Int>>()
    for (pid in pids) {
      val fdDir = File(root, "$pid/fd")
      val fds = fdDir.list() ?: continue
      readable = true
      for (fd in fds) {
        val link = link(File(fdDir, fd)) ?: continue
        if (!link.startsWith("pipe:[")) continue
        val inode = Stdin.inodeOf(link) ?: continue
        if (inode !in inodes) continue
        val info = text(File(root, "$pid/fdinfo/$fd")) ?: continue
        if (ProcFields.writes(info)) out.getOrPut(inode) { HashSet() } += pid
      }
    }
    return if (readable) out else null
  }

  private fun stdin(fdDir: File): Stdin {
    link(File(fdDir, "0"))?.let { return Stdin.of(it) }
    // No fd 0 in a folder we can list: stdin is closed.
    val fds = fdDir.list() ?: return Stdin.UNKNOWN
    return if ("0" in fds) Stdin.UNKNOWN else Stdin.NONE
  }

  private fun link(file: File): String? = try {
    Files.readSymbolicLink(file.toPath()).toString()
  } catch (_: Exception) {
    null
  }

  private fun text(file: File): String? = try {
    file.readText(Charsets.UTF_8)
  } catch (_: Exception) {
    null
  }

  private fun bytes(file: File): ByteArray? = try {
    file.readBytes()
  } catch (_: Exception) {
    null
  }
}
