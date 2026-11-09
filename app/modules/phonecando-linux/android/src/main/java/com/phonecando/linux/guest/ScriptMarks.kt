package com.phonecando.linux.guest

import com.phonecando.linux.jobs.ScriptRetry

/**
 * The marker lines a rendered install script prints for us (kit-render
 * InstallScript): `@phase <name>` before each phase, and
 * `@retry <phase> <n>/<max>` before a failed step runs again. Only a whole
 * line counts, so a command that echoes one in passing does not. Pure.
 */
internal object ScriptMarks {
  private const val NAME = "[A-Za-z0-9][A-Za-z0-9:._-]{0,63}"
  private val PHASE = Regex("@phase[ \\t]+($NAME)[ \\t]*")
  private val RETRY = Regex("@retry[ \\t]+$NAME[ \\t]+([0-9]{1,3})/([0-9]{1,3})[ \\t]*")

  /** The name of a `@phase <name>` line; null for any other line. */
  fun phaseOf(line: String): String? = PHASE.matchEntire(line)?.groupValues?.get(1)

  /** The try and the most tries of a `@retry <phase> <n>/<max>` line (1 ≤ n ≤ max); null for any other line. */
  fun retryOf(line: String): ScriptRetry? {
    val match = RETRY.matchEntire(line) ?: return null
    val attempt = match.groupValues[1].toInt()
    val max = match.groupValues[2].toInt()
    return if (attempt in 1..max) ScriptRetry(attempt, max) else null
  }
}
