package com.phonecando.runner.engine.spawn

import com.phonecando.runner.engine.proc.EngineProcess
import java.io.File

/** A server engine's process; its output is the engine log. */
internal class ServerProcess(private val process: Process, private val logFile: File) : EngineProcess {
  override val isAlive: Boolean get() = process.isAlive

  override fun terminate() = process.destroy()

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
