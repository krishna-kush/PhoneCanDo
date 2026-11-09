package com.phonecando.runner.engine.proc

/**
 * An engine's own process as the supervisor holds it, however it started:
 * a plain process (server engines) or a program on a PTY (TUI engines).
 */
interface EngineProcess {
  val isAlive: Boolean

  /** Asks it to end: SIGTERM, or a TUI's terminal hung up. */
  fun terminate()

  /** SIGKILL. */
  fun kill()

  /** Its exit status once it has ended; null while it runs. */
  fun exitStatus(): Int?

  /** Blocks until it ends; its exit status. */
  fun waitFor(): Int

  /** At most [max] bytes from the end of its output, and whether earlier output is left out; null when none can be read. */
  fun outputTail(max: Int): Pair<ByteArray, Boolean>?
}
