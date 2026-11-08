package com.phonecando.terminal

// JNI entry points of libphonecando_pty (cpp/forkpty.c). Strings cross as
// UTF-8 bytes: JNI's own string conversion is "modified UTF-8", which mangles
// emoji and other non-BMP characters in paths and arguments. Failures throw
// IOException with the failed step and errno text.
internal object PhoneCanDoPty {
  init {
    System.loadLibrary("phonecando_pty")
  }

  /**
   * Starts [cmd] on a new PTY with exactly [env]; returns [masterFd, pid].
   * [handOver] leaves the PTY no session's controlling terminal, for a
   * program that hands it on to a child of its own.
   */
  external fun openPty(
    cmd: Array<ByteArray>,
    env: Array<ByteArray>,
    cwd: ByteArray,
    rows: Int,
    cols: Int,
    raw: Boolean,
    handOver: Boolean,
  ): IntArray
  /** Bytes read, 0 when nothing is waiting, -1 once the child side is gone. */
  external fun readPty(fd: Int, buf: ByteArray, len: Int): Int
  external fun writePty(fd: Int, buf: ByteArray, len: Int): Int
  external fun setWinSize(fd: Int, rows: Int, cols: Int)
  external fun closePty(fd: Int)
  /** Blocks until [pid] has exited, leaving it unreaped (its pid can't be reused yet). */
  external fun awaitExit(pid: Int)
  /** Reaps exactly [pid]; returns [code, signal]: code -1 if a signal ended it, signal 0 if not. */
  external fun reap(pid: Int): IntArray
  /** Sends [signal] to [pid]'s whole process group; a group already gone is not an error. */
  external fun killGroup(pid: Int, signal: Int)
}
