package com.phonecando.terminal

/** A program just started on its own PTY: the master fd and the child behind it. */
internal class SpawnedPty(val fd: Int, val child: PtyChild)

/**
 * Starts [argv] on a new PTY with exactly [env] (KEY=VALUE entries, the
 * program's entire environment) and starts reaping it. The one spawn path
 * for the module's own sessions and the hosted PTYs. Throws IOException
 * naming the failed step.
 */
internal fun spawnPty(
  argv: List<String>,
  env: List<String>,
  cwd: String,
  rows: Int,
  cols: Int,
  raw: Boolean,
  handOver: Boolean,
): SpawnedPty {
  val (fd, pid) = PhoneCanDoPty.openPty(
    argv.map { it.cBytes() }.toTypedArray(),
    env.map { it.cBytes() }.toTypedArray(),
    cwd.cBytes(),
    rows,
    cols,
    raw,
    handOver,
  )
  return SpawnedPty(fd, PtyChild(pid))
}

// C strings end at the first NUL, so one inside would silently cut the value.
private fun String.cBytes(): ByteArray {
  require('\u0000' !in this) { "NUL in pty argument" }
  return toByteArray(Charsets.UTF_8)
}
