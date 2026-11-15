package com.phonecando.runner.engine.acp

import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.spawn.LogTail
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

/**
 * An ACP engine's process: its stdin and stdout are the ACP pipes, its
 * stderr the engine log, and [setup] what its driver opens chats with.
 * A stop closes its stdin first (many agents end then), then SIGTERM.
 */
internal class AcpProcess(private val process: Process, private val logFile: File, val setup: AcpSetup) : EngineProcess {
  /** Its stdout: what the agent says to us. */
  val input: InputStream get() = process.inputStream

  /** Its stdin: what we say to it. */
  val output: OutputStream get() = process.outputStream

  override val isAlive: Boolean get() = process.isAlive

  override fun terminate() {
    try {
      process.outputStream.close()
    } catch (_: IOException) {
    }
    process.destroy()
  }

  override fun kill() {
    process.destroyForcibly()
  }

  override fun exitStatus(): Int? = try {
    process.exitValue()
  } catch (_: IllegalThreadStateException) {
    null
  }

  override fun waitFor(): Int = process.waitFor()

  override fun outputTail(max: Int): Pair<ByteArray, Boolean>? = LogTail.read(logFile, max)
}
