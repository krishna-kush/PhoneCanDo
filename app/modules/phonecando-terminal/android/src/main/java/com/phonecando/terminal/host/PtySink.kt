package com.phonecando.terminal.host

/** Takes one hosted PTY's output and its end, on that PTY's own reader thread. */
interface PtySink {
  /**
   * The first [len] bytes of [bytes] are new output. The array is reused for
   * the next read, so copy what you keep.
   */
  fun onOutput(bytes: ByteArray, len: Int)

  /**
   * Called once, after the last output: the exit code, 128 + the signal that
   * ended the program, or -1 when its status was not ours to read.
   */
  fun onExit(status: Int)
}
