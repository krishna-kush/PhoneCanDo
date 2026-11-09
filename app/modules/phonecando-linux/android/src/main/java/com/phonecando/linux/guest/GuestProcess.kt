package com.phonecando.linux.guest

import com.phonecando.linux.images.GuestCommand
import com.phonecando.linux.images.ImageProcesses
import com.phonecando.linux.images.ImageReaper
import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.ImageLayout
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Runs one guest program of ours (an agent's install script, its version
 * check) through the image's shims: our launcher, then proot. HOME and
 * TMPDIR are the guest's /root and /tmp, as in the terminal; the cwd is
 * run/, under no `same` path, so the guest starts in /root. [run] feeds
 * `input` to its stdin and hands its stdout (with stderr merged, or
 * stderr dropped) to `output` on a thread of its own.
 *
 * The program and all it starts carry a run tag of their own (RUN_TAG):
 * once it ends, times out or is cancelled, whatever is still running with
 * that tag is stopped, while the image's engine and terminals run on.
 */
internal class GuestProcess(
  private val baseEnv: () -> Map<String, String> = System::getenv,
  private val reaper: ImageReaper = ImageReaper(),
) {
  /** How a run ended. */
  sealed interface End {
    data class Exited(val code: Int) : End

    data object TimedOut : End

    data object Cancelled : End
  }

  fun run(
    layout: ImageLayout,
    argv: List<String>,
    input: ByteArray,
    timeoutMillis: Long,
    cancel: CancelSignal,
    mergeStderr: Boolean,
    output: (InputStream) -> Unit,
  ): End {
    val runId = UUID.randomUUID().toString()
    val engineEnv = if (layout.engineEnv.isFile) layout.engineEnv.readText(Charsets.UTF_8) else ""
    val overrides = GuestCommand.GUEST_DIRS + (ImageProcesses.RUN_TAG to runId)
    val command = GuestCommand.build(layout, argv, engineEnv, baseEnv(), overrides)
    val builder = ProcessBuilder(command.argv).directory(layout.run).redirectErrorStream(mergeStderr)
    builder.environment().clear()
    builder.environment().putAll(command.env)
    val process = builder.start()
    val pumps = listOfNotNull(
      thread(isDaemon = true, name = "phonecando-guest-in") { feed(process.outputStream.buffered(), input) },
      thread(isDaemon = true, name = "phonecando-guest-out") { pump(process.inputStream, output) },
      if (mergeStderr) null else thread(isDaemon = true, name = "phonecando-guest-err") { pump(process.errorStream) {} },
    )
    var end: End? = null
    try {
      end = await(process, System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis), cancel)
      return end
    } finally {
      if (end !is End.Exited) {
        process.destroyForcibly()
        process.waitFor(KILL_WAIT_MS, TimeUnit.MILLISECONDS)
      }
      // Before the pumps end: what the program left running may hold its pipes.
      reaper.stopRun(runId)
      pumps.forEach { it.join(KILL_WAIT_MS) }
    }
  }

  private fun await(process: Process, deadline: Long, cancel: CancelSignal): End {
    while (true) {
      if (process.waitFor(POLL_MS, TimeUnit.MILLISECONDS)) return End.Exited(process.exitValue())
      if (cancel.isCancelled()) return End.Cancelled
      if (System.nanoTime() - deadline >= 0) return End.TimedOut
    }
  }

  private fun feed(stdin: OutputStream, input: ByteArray) {
    try {
      stdin.use { it.write(input) }
    } catch (_: IOException) {
      // It ended before reading it all.
    }
  }

  // Hands the stream to [read], then drains what it left: the program must never block on a full pipe.
  private fun pump(stream: InputStream, read: (InputStream) -> Unit) {
    try {
      stream.use {
        read(it)
        val skip = ByteArray(BUFFER)
        while (it.read(skip) >= 0) Unit
      }
    } catch (_: IOException) {
      // The program went away; what was read stands.
    }
  }

  companion object {
    const val BUFFER = 8192
    private const val POLL_MS = 200L
    private const val KILL_WAIT_MS = 5_000L
  }
}
