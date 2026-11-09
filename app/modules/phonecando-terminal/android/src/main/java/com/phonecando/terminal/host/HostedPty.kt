package com.phonecando.terminal.host

/** A program [PtyHost] runs on its own PTY. Every call is safe from any thread. */
interface HostedPty {
  /** The program's pid, also its process group id. */
  val pid: Int

  /** False once the program has exited and been reaped; [PtySink.onExit] follows its last output. */
  val isAlive: Boolean

  /**
   * Writes all of [bytes]. Blocks while the program doesn't read, and gives
   * up after about a second without progress. Does nothing after the hang-up.
   */
  fun write(bytes: ByteArray)

  /**
   * Sets the window size. The same size again still sends SIGWINCH, so the
   * program repaints. Does nothing after the hang-up.
   */
  fun resize(rows: Int, cols: Int)

  /** Sends [signal] to the program's whole process group; nothing once it has been reaped. */
  fun signalGroup(signal: Int)

  /**
   * Hangs up and returns at once: the reader closes the master within a
   * moment, sends SIGHUP to the group, and SIGKILL after a grace period if
   * the program still runs. [PtySink.onExit] reports the end as usual.
   */
  fun close()
}
