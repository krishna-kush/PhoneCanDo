package com.phonecando.terminal

import java.util.concurrent.ConcurrentHashMap

// The PTYs this module opened, by master fd. Every fd-taking call looks the
// fd up here first: once closed, the kernel may hand that number to any other
// open() in our process, and we must never read, write or resize it then.
internal class PtySessions {
  private val children = ConcurrentHashMap<Int, PtyChild>()

  /**
   * Starts [cmd] on a new PTY and returns its master fd. The program gets our
   * own environment with [env] on top, as before; the native layer itself
   * passes on exactly the list it is given.
   */
  fun open(
    cmd: List<String>,
    env: Map<String, String>,
    cwd: String,
    rows: Int,
    cols: Int,
    raw: Boolean,
    handOver: Boolean,
  ): Int {
    require(cmd.isNotEmpty()) { "cmd required" }
    env.keys.forEach { require(it.isNotEmpty() && '=' !in it) { "bad env name: $it" } }
    val merged = System.getenv() + env
    val (fd, pid) = PhoneCanDoPty.openPty(
      cmd.map { it.cBytes() }.toTypedArray(),
      merged.map { (k, v) -> "$k=$v".cBytes() }.toTypedArray(),
      cwd.cBytes(),
      rows,
      cols,
      raw,
      handOver,
    )
    children[fd] = PtyChild(pid)
    return fd
  }

  /** The child on [fd]; throws for an fd we never opened or already closed. */
  fun child(fd: Int): PtyChild = children[fd] ?: throw IllegalStateException("pty fd $fd is not open")

  /** Closes the master: the kernel hangs up the session and the reaper collects the child. */
  fun close(fd: Int) {
    if (children.remove(fd) != null) PhoneCanDoPty.closePty(fd)
  }

  fun closeAll() {
    children.keys.toList().forEach(::close)
  }
}

// C strings end at the first NUL, so one inside would silently cut the value.
private fun String.cBytes(): ByteArray {
  require('\u0000' !in this) { "NUL in pty argument" }
  return toByteArray(Charsets.UTF_8)
}
