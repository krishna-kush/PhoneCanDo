package com.phonecando.terminal.host

import com.phonecando.terminal.spawnPty

/**
 * Starts PTYs whose lifetime the caller owns (the runner's TUI engines).
 * Process-wide: they don't belong to the Expo module, so a JS reload, which
 * hangs up the module's own sessions, leaves them running.
 */
object PtyHost {
  /**
   * Starts [spec] on a new PTY; a reader thread hands its output to [sink]
   * until the program ends. Throws IOException naming the failed step
   * (lookup, open, fork, session, chdir, exec), IllegalArgumentException
   * for an empty argv or an env entry that isn't KEY=VALUE.
   */
  fun spawn(spec: PtySpawnSpec, sink: PtySink): HostedPty {
    require(spec.argv.isNotEmpty()) { "argv required" }
    // The index only: an entry may hold a secret.
    spec.env.forEachIndexed { i, entry ->
      require(entry.indexOf('=') > 0) { "env entry $i is not KEY=VALUE" }
    }
    val pty = spawnPty(spec.argv, spec.env, spec.cwd, spec.rows, spec.cols, spec.raw, spec.handOver)
    return HostedSession(pty, sink).also { it.start() }
  }
}
