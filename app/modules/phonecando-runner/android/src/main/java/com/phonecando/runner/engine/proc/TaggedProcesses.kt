package com.phonecando.runner.engine.proc

import com.phonecando.runner.engine.EngineEnv

// Finding an agent's processes: every process of our uid whose environment
// carries PHONECANDO_AGENT=<agentId> (EngineEnv.AGENT). The engine and
// whatever it started inherit the tag, so this finds a shell, a language
// server or a proot an engine left behind, and engines from an earlier app
// process. Never our own pid. Pure: ProcScanner feeds it /proc.

/**
 * One /proc entry: [tag] is its PHONECANDO_AGENT value, null when absent or
 * unreadable; [model] its PHONECANDO_MODEL (a model server's model id).
 */
data class ProcEntry(val pid: Int, val uid: Int, val zombie: Boolean, val tag: String?, val model: String? = null)

object TaggedProcesses {
  const val TAG = EngineEnv.AGENT

  /** The pids to signal: ours, alive, tagged with one of [agentIds] (null: any agent). */
  fun select(entries: List<ProcEntry>, agentIds: Set<String>?, myPid: Int, myUid: Int): List<Int> =
    entries.filter { e ->
      e.pid != myPid && e.uid == myUid && !e.zombie && e.tag != null &&
        e.tag.isNotEmpty() && (agentIds == null || e.tag in agentIds)
    }.map { it.pid }

  /** The tag in /proc/<pid>/environ (NUL-separated KEY=VALUE). */
  fun tagOf(environ: ByteArray): String? = parseEnviron(environ)[TAG]

  /** The tag and the model id in /proc/<pid>/environ. */
  fun tagsOf(environ: ByteArray): Pair<String?, String?> =
    parseEnviron(environ).let { it[TAG] to it[EngineEnv.MODEL] }

  fun parseEnviron(environ: ByteArray): Map<String, String> {
    val out = LinkedHashMap<String, String>()
    var start = 0
    for (i in 0..environ.size) {
      if (i < environ.size && environ[i] != 0.toByte()) continue
      if (i > start) {
        val entry = String(environ, start, i - start, Charsets.UTF_8)
        val eq = entry.indexOf('=')
        // The first value wins, as getenv() reads it.
        if (eq > 0) out.putIfAbsent(entry.substring(0, eq), entry.substring(eq + 1))
      }
      start = i + 1
    }
    return out
  }

  /** (real uid, zombie) from /proc/<pid>/status; null when it has no Uid line. */
  fun parseStatus(status: String): Pair<Int, Boolean>? {
    var uid: Int? = null
    var zombie = false
    for (line in status.lineSequence()) {
      when {
        line.startsWith("Uid:") -> uid = line.substring(4).trim().split(WS).firstOrNull()?.toIntOrNull()
        line.startsWith("State:") -> zombie = line.substring(6).trim().let { it.startsWith("Z") || it.startsWith("X") }
      }
    }
    return uid?.let { it to zombie }
  }

  private val WS = Regex("\\s+")
}
