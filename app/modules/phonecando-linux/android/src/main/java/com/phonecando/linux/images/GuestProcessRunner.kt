package com.phonecando.linux.images

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.image.reset.GuestResult
import com.phonecando.lre.image.reset.GuestRunner
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Runs a guest command through the image's shims (our launcher, then
 * proot) and captures stdout. The cwd is run/, under no `same` path, so
 * the guest starts in /root. Killed after [timeoutMillis].
 *
 * Only for an image the host has stopped (a reset). The launcher returns
 * when the command ends while what it started runs on, as on a PC (a
 * package manager's gpg-agent, say); nothing may run while a reset swaps
 * the system, so once the command returns or times out, everything still
 * carrying the image's tag is stopped too ([reap], ImageReaper by default).
 */
class GuestProcessRunner(
  private val timeoutMillis: Long = 60_000,
  private val baseEnv: () -> Map<String, String> = System::getenv,
  private val reap: (imageRoot: String) -> Unit = { ImageReaper().stopAll(it) },
) : GuestRunner {
  override fun run(layout: ImageLayout, argv: List<String>): GuestResult {
    val engineEnv = if (layout.engineEnv.isFile) layout.engineEnv.readText(Charsets.UTF_8) else ""
    val command = GuestCommand.build(layout, argv, engineEnv, baseEnv())
    val builder = ProcessBuilder(command.argv).directory(layout.run)
    builder.environment().clear()
    builder.environment().putAll(command.env)
    val process = builder.start()
    process.outputStream.close()
    val stdout = ByteArrayOutputStream()
    val readers = listOf(
      drain(process.inputStream, stdout),
      drain(process.errorStream, null),
    )
    val ended = process.waitFor(timeoutMillis, TimeUnit.MILLISECONDS)
    if (!ended) {
      process.destroyForcibly()
      process.waitFor(KILL_WAIT_MS, TimeUnit.MILLISECONDS)
    }
    // Before draining: what the command left running may hold its pipes.
    reap(layout.root.path)
    if (!ended) throw IOException("guest command ${argv.first()} timed out after ${timeoutMillis / 1000} s")
    readers.forEach { it.join(KILL_WAIT_MS) }
    return GuestResult(process.exitValue(), synchronized(stdout) { stdout.toString(Charsets.UTF_8.name()) })
  }

  // Reads [input] to its end, keeping at most MAX_STDOUT bytes in [into] (null: discard).
  private fun drain(input: InputStream, into: ByteArrayOutputStream?) = thread(isDaemon = true, name = "phonecando-guest-io") {
    val buf = ByteArray(8192)
    try {
      input.use {
        while (true) {
          val n = it.read(buf)
          if (n < 0) break
          if (into != null) synchronized(into) { if (into.size() < MAX_STDOUT) into.write(buf, 0, minOf(n, MAX_STDOUT - into.size())) }
        }
      }
    } catch (_: IOException) {
      // The process went away; what we read so far stands.
    }
  }

  private companion object {
    const val KILL_WAIT_MS = 5_000L
    const val MAX_STDOUT = 4 * 1024 * 1024
  }
}
