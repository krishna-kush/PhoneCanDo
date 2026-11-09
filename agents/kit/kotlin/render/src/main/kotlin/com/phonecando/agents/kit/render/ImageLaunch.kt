package com.phonecando.agents.kit.render

import java.io.File

// An image kind's program runs inside its Linux image: argv[0] is a guest
// command or an absolute guest path, started by the guest's sh through the
// image's shims/sh (our launcher, which hands the terminal on to it), so
// `exec "$0" "$@"` replaces that sh with the program and its args, unquoted
// and unexpanded. It sees the guest as the machine's terminal does: HOME is
// GUEST_HOME, TMPDIR GUEST_TMP, and the sh first changes to its guest cwd
// (the launcher would keep a host cwd under HOME's host path as it is, and
// the program would see that). The kind's runtimes' paths (rendered guest
// folders) go first on PATH, so the program and what it runs find them.
object ImageLaunch {
  /** Where the image's home/ and tmp/ are bound in the guest (lre's LaunchConf). */
  const val GUEST_HOME = "/root"
  const val GUEST_TMP = "/tmp"
  const val EXEC = "exec \"\$0\" \"\$@\""

  /** HOME and TMPDIR as the guest names them. */
  val GUEST_DIRS: Map<String, String> = mapOf("HOME" to GUEST_HOME, "TMPDIR" to GUEST_TMP)

  fun wrap(argv: List<String>, image: File, paths: List<String> = emptyList(), cwd: String? = null): List<String> =
    listOf(File(File(image, "shims"), "sh").path, "-c", script(paths, cwd)) + argv

  /**
   * The `sh -c` script: `cd <cwd> || exit; ` when there is a [cwd], then
   * `PATH=<paths>:$PATH; export PATH; ` when there are [paths], then [EXEC].
   */
  fun script(paths: List<String>, cwd: String? = null): String = buildString {
    if (cwd != null) append("cd ${ShellQuote.word(cwd)} || exit; ")
    if (paths.isNotEmpty()) append("PATH=${ShellQuote.word(paths.joinToString(":"))}:\$PATH; export PATH; ")
    append(EXEC)
  }
}
