package com.phonecando.runner.models.measure

import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

// Runs a model server's dry run (lme's FitBreakdown.dryRun) and reads its
// stdout line by line until [parse] finds the measurement, the process
// ends, it has said more than [MAX_BYTES], or [timeoutMs] passes; then
// kills it, before it loads the model for real. Its output goes nowhere
// else: the server's own log (and its log page) never sees these JSON
// lines.
internal object FitProbe {
  const val TIMEOUT_MS = 30_000L
  private const val MAX_BYTES = 4L shl 20
  private const val EXIT_WAIT_MS = 2_000L

  fun <T : Any> run(argv: List<String>, env: Map<String, String>, cwd: File, timeoutMs: Long = TIMEOUT_MS, parse: (String) -> T?): T? {
    val pb = ProcessBuilder(argv).directory(cwd).redirectErrorStream(true)
    pb.environment().apply {
      clear()
      putAll(env)
    }
    val proc = pb.start()
    val watchdog = thread(name = "phonecando-model-measure", isDaemon = true) {
      try {
        if (!proc.waitFor(timeoutMs, TimeUnit.MILLISECONDS)) proc.destroyForcibly()
      } catch (_: InterruptedException) {
        // The read ended first.
      }
    }
    try {
      var read = 0L
      proc.inputStream.bufferedReader().use { lines ->
        while (read <= MAX_BYTES) {
          val line = lines.readLine() ?: return null
          read += line.length + 1
          parse(line)?.let { return it }
        }
      }
      return null
    } catch (_: IOException) {
      return null
    } finally {
      proc.destroyForcibly()
      watchdog.interrupt()
      try {
        proc.waitFor(EXIT_WAIT_MS, TimeUnit.MILLISECONDS)
      } catch (_: InterruptedException) {
        Thread.currentThread().interrupt()
      }
    }
  }
}
