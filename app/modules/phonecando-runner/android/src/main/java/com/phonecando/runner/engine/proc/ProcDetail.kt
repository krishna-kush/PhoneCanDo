package com.phonecando.runner.engine.proc

// One of our processes as job detection (engine/work/) sees it, and the
// parsers for the /proc files it comes from. Pure: DetailScanner reads the
// files.

/**
 * [startedAt] and [cpuMs] are epoch ms and ms of CPU (its own and its
 * reaped children's); [tag] its PHONECANDO_AGENT; [tracerPid] the proot
 * tracing it, 0 for none; [argv] its command line (empty when unreadable);
 * [ioBytes] the bytes it read and wrote (sockets too), null when unreadable.
 * [startTicks] is its start as the kernel counts it: with the pid, what
 * tells one process from a later one across reads ([startedAt] moves by a
 * ms or two between reads, as the clocks are read again). [exe] is the file
 * name of the binary it runs (/proc/<pid>/exe): a guest under proot runs
 * proot's loader, our launcher answers to its command's name in [argv].
 */
data class ProcDetail(
  val pid: Int,
  val ppid: Int,
  val startedAt: Long,
  val tag: String?,
  val tracerPid: Int,
  val name: String?,
  val argv: List<String>,
  val stdin: Stdin,
  val cpuMs: Long,
  val ioBytes: Long? = null,
  val startTicks: Long = startedAt,
  val exe: String? = null,
)

/** What fd 0 points at; [inode] for a pipe or a socket. */
data class Stdin(val kind: Kind, val inode: Long? = null) {
  enum class Kind { NULL, TTY, PIPE, SOCKET, FILE, OTHER, NONE, UNKNOWN }

  companion object {
    val NONE = Stdin(Kind.NONE)
    val UNKNOWN = Stdin(Kind.UNKNOWN)

    /** From the fd/0 link's target. */
    fun of(link: String): Stdin = when {
      link == "/dev/null" -> Stdin(Kind.NULL)
      link.startsWith("/dev/pts/") || link.startsWith("/dev/tty") || link == "/dev/console" -> Stdin(Kind.TTY)
      link.startsWith("pipe:[") -> Stdin(Kind.PIPE, inodeOf(link))
      link.startsWith("socket:[") -> Stdin(Kind.SOCKET, inodeOf(link))
      link.startsWith("/") -> Stdin(Kind.FILE)
      else -> Stdin(Kind.OTHER)
    }

    /** The inode in "pipe:[123]" or "socket:[123]". */
    fun inodeOf(link: String): Long? = link.substringAfter('[', "").substringBefore(']').toLongOrNull()
  }
}

object ProcFields {
  /** ppid, start time and CPU (utime + stime + cutime + cstime) in clock ticks, from /proc/<pid>/stat. */
  data class Stat(val ppid: Int, val startTicks: Long, val cpuTicks: Long)

  // The name in parentheses may hold spaces and ')': the fields start after the last one.
  fun parseStat(stat: String): Stat? {
    val close = stat.lastIndexOf(')')
    if (close < 0) return null
    val f = stat.substring(close + 1).trim().split(WS)
    // f[0] is the state, so field n of stat(5) is f[n - 3].
    if (f.size < 20) return null
    val ppid = f[1].toIntOrNull() ?: return null
    val cpu = (11..14).sumOf { f[it].toLongOrNull() ?: 0L }
    val start = f[19].toLongOrNull() ?: return null
    return Stat(ppid, start, cpu)
  }

  /** TracerPid and Name from /proc/<pid>/status. */
  fun parseTracer(status: String): Pair<Int, String?> {
    var tracer = 0
    var name: String? = null
    for (line in status.lineSequence()) {
      when {
        line.startsWith("TracerPid:") -> tracer = line.substring(10).trim().toIntOrNull() ?: 0
        line.startsWith("Name:") -> name = line.substring(5).trim()
      }
    }
    return tracer to name
  }

  /** The NUL-separated arguments of /proc/<pid>/cmdline. */
  fun parseCmdline(bytes: ByteArray): List<String> =
    String(bytes, Charsets.UTF_8).split('\u0000').dropLastWhile { it.isEmpty() }

  /** rchar + wchar from /proc/<pid>/io. */
  fun parseIo(io: String): Long? {
    var total = 0L
    var seen = false
    for (line in io.lineSequence()) {
      val value = when {
        line.startsWith("rchar:") -> line.substring(6)
        line.startsWith("wchar:") -> line.substring(6)
        else -> continue
      }
      total += value.trim().toLongOrNull() ?: continue
      seen = true
    }
    return total.takeIf { seen }
  }

  /** Whether an fdinfo's flags open the file for writing (O_WRONLY or O_RDWR). */
  fun writes(fdinfo: String): Boolean {
    val line = fdinfo.lineSequence().firstOrNull { it.startsWith("flags:") } ?: return false
    val flags = line.substring(6).trim().toIntOrNull(8) ?: return false
    return flags and O_ACCMODE != O_RDONLY
  }

  private const val O_ACCMODE = 3
  private const val O_RDONLY = 0
  private val WS = Regex("\\s+")
}
