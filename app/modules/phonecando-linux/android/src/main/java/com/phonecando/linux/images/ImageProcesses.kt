package com.phonecando.linux.images

// Finding an image's processes: every process of our uid whose environment
// carries PHONECANDO_IMAGE=<image root>. The engine sets it (run/engine.env),
// so does the Linux terminal (TerminalRecipe) and every guest command keeps
// it (launch.conf unsets only secrets), so this finds a dev server the agent
// left running, a daemon started from the terminal, or a proot still tracing
// them. The runner's engine reaper does the same by PHONECANDO_AGENT; this
// one is for reset and delete, which must not pull the system out from
// under a running guest. Pure: ImageReaper feeds it /proc.
internal object ImageProcesses {
  const val TAG = "PHONECANDO_IMAGE"

  /** One /proc entry: [image] is its PHONECANDO_IMAGE value, null when absent or unreadable. */
  data class Entry(val pid: Int, val uid: Int, val zombie: Boolean, val image: String?)

  /** The pids to signal: ours, alive, tagged with exactly [imageRoot]; never [myPid]. */
  fun select(entries: List<Entry>, imageRoot: String, myPid: Int, myUid: Int): List<Int> =
    entries.filter { e -> e.pid != myPid && e.uid == myUid && !e.zombie && e.image == imageRoot }.map { it.pid }

  /** The tag in /proc/<pid>/environ (NUL-separated KEY=VALUE); the first one wins, as getenv() reads it. */
  fun tagOf(environ: ByteArray): String? {
    var start = 0
    for (i in 0..environ.size) {
      if (i < environ.size && environ[i] != 0.toByte()) continue
      if (i > start) {
        val entry = String(environ, start, i - start, Charsets.UTF_8)
        if (entry.startsWith("$TAG=")) return entry.substring(TAG.length + 1)
      }
      start = i + 1
    }
    return null
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
