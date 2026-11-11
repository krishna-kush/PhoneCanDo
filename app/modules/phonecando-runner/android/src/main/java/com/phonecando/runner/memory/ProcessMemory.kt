package com.phonecando.runner.memory

import com.phonecando.runner.engine.proc.ProcEntry
import java.io.File

// What our engines and model servers take. Every process of ours tagged
// with an agent (PHONECANDO_AGENT=<agentId>: the engine and all it started,
// as the reaper finds them) or a model server (AGENT=[modelTag] and
// PHONECANDO_MODEL=<model id>) counts for its owner, each as its PSS from
// /proc/<pid>/smaps_rollup (shared pages split among the processes that
// map them, so the sums add up), else its VmRSS from /proc/<pid>/status.
// Read only while memory is short or the app asks (memoryStatus): a couple
// of small files per process. Pure JVM; the root is a parameter so tests
// can hand it a folder.
class ProcessMemory(private val root: File = File("/proc")) {
  /** Bytes per agent id and per model id. */
  data class Owners(val agents: Map<String, Long>, val models: Map<String, Long>)

  /** [entries]: a ProcScanner scan. */
  fun read(entries: List<ProcEntry>, myPid: Int, myUid: Int, modelTag: String): Owners =
    group(entries, myPid, myUid, modelTag, ::bytes)

  /** One process's PSS, else its VmRSS; null when neither can be read (it is gone). */
  fun bytes(pid: Int): Long? {
    val dir = File(root, pid.toString())
    read(File(dir, "smaps_rollup"))?.let(::pssBytes)?.let { return it }
    return read(File(dir, "status"))?.let(::rssBytes)
  }

  private fun read(file: File): String? = try {
    file.readText(Charsets.UTF_8)
  } catch (_: Exception) {
    null
  }

  companion object {
    /** Sums [bytesOf] per owner over our live tagged processes (never our own). */
    fun group(entries: List<ProcEntry>, myPid: Int, myUid: Int, modelTag: String, bytesOf: (Int) -> Long?): Owners {
      val agents = HashMap<String, Long>()
      val models = HashMap<String, Long>()
      for (e in entries) {
        val tag = e.tag
        if (e.pid == myPid || e.uid != myUid || e.zombie || tag.isNullOrEmpty()) continue
        val (owners, owner) = if (tag == modelTag) models to (e.model ?: continue) else agents to tag
        val bytes = bytesOf(e.pid) ?: continue
        owners[owner] = (owners[owner] ?: 0L) + bytes
      }
      return Owners(agents, models)
    }

    /** The `Pss:` line of smaps_rollup, in bytes. */
    fun pssBytes(smapsRollup: String): Long? = kbLine(smapsRollup, "Pss:")

    /** The `VmRSS:` line of status, in bytes. */
    fun rssBytes(status: String): Long? = kbLine(status, "VmRSS:")

    private fun kbLine(text: String, key: String): Long? {
      for (line in text.lineSequence()) {
        if (!line.startsWith(key)) continue
        val kb = line.substring(key.length).trim().split(WS).firstOrNull()?.toLongOrNull() ?: return null
        return kb * 1024L
      }
      return null
    }

    private val WS = Regex("\\s+")
  }
}
