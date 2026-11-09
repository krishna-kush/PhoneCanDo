package com.phonecando.runner.engine.spawn

import com.phonecando.runner.engine.proc.EngineProcess
import java.io.File
import java.io.RandomAccessFile

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

  // Reads at most [max] bytes from the end, however long the file or its lines.
  override fun outputTail(max: Int): Pair<ByteArray, Boolean>? = try {
    RandomAccessFile(logFile, "r").use { f ->
      val len = f.length()
      val start = maxOf(0L, len - max)
      val window = ByteArray((len - start).toInt())
      f.seek(start)
      f.readFully(window)
      window to (start > 0)
    }
  } catch (_: Exception) {
    null
  }
}
