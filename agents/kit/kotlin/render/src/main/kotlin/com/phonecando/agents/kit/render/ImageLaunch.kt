package com.phonecando.agents.kit.render

import java.io.File

// An image kind's program runs inside its Linux image: argv[0] is a guest
// command or an absolute guest path, started by the guest's sh through the
// image's shims/sh (our launcher, which hands the terminal on to it), so
// `exec "$0" "$@"` replaces that sh with the program and its args, unquoted
// and unexpanded. It sees the guest as the machine's terminal does: HOME is
// GUEST_HOME, TMPDIR GUEST_TMP, and the sh first changes to its guest cwd
// (the launcher would keep a host cwd under HOME's host path as it is, and
// the program would see that). The launcher unsets what the image's other
// agents keep from their guests (GuestEnvPolicy), so the host passes each
// of those this program still needs under CARRY_PREFIX, and the sh puts it
// back under its own name. The kind's runtimes' paths (rendered guest
// folders) go first on PATH, so the program and what it runs find them.
object ImageLaunch {
  /** Where the image's home/ and tmp/ are bound in the guest (lre's LaunchConf). */
  const val GUEST_HOME = "/root"
  const val GUEST_TMP = "/tmp"
  const val EXEC = "exec \"\$0\" \"\$@\""

  /** A carried env value's name past the launcher: the prefix, then its own name. */
  const val CARRY_PREFIX = "PHONECANDO_CARRY_"

  /** HOME and TMPDIR as the guest names them. */
  val GUEST_DIRS: Map<String, String> = mapOf("HOME" to GUEST_HOME, "TMPDIR" to GUEST_TMP)

  private val ENV_NAME = Regex("[A-Za-z_][A-Za-z0-9_]*")

  fun wrap(
    argv: List<String>,
    image: File,
    paths: List<String> = emptyList(),
    cwd: String? = null,
    carry: Collection<String> = emptySet(),
  ): List<String> = listOf(File(File(image, "shims"), "sh").path, "-c", script(paths, cwd, carry)) + argv

  /**
   * The `sh -c` script: `cd <cwd> || exit; ` when there is a [cwd], then for
   * each [carry] name, in name order, `NAME="$PHONECANDO_CARRY_NAME"; export
   * NAME; unset PHONECANDO_CARRY_NAME; `, then `PATH=<paths>:$PATH; export
   * PATH; ` when there are [paths], then [EXEC]. Throws KindException for a
   * carry name that is no env name.
   */
  fun script(paths: List<String>, cwd: String? = null, carry: Collection<String> = emptySet()): String = buildString {
    if (cwd != null) append("cd ${ShellQuote.word(cwd)} || exit; ")
    for (name in carry.distinct().sorted()) {
      if (!ENV_NAME.matches(name)) throw KindException("cannot carry $name: not an env name")
      append("$name=\"\$$CARRY_PREFIX$name\"; export $name; unset $CARRY_PREFIX$name; ")
    }
    if (paths.isNotEmpty()) append("PATH=${ShellQuote.word(paths.joinToString(":"))}:\$PATH; export PATH; ")
    append(EXEC)
  }

  /** [env] with each [carry] name it holds renamed to CARRY_PREFIX + the name, in place: what the host starts the launcher with. */
  fun carried(env: Map<String, String>, carry: Collection<String>): Map<String, String> =
    env.entries.associateTo(LinkedHashMap()) { (name, value) -> (if (name in carry) CARRY_PREFIX + name else name) to value }
}
