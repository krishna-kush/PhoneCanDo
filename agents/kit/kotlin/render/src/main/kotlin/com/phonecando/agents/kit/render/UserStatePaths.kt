package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.ProjectDir

// What a kind's `userState` may name: the host deletes these paths when an
// agent that kept the kind's defaults leaves a machine that stays, so each
// is a plain path in HOME and never takes what every agent on the machine
// shares. SHARED may not be named, held or lain in: the work folder, our
// own files, keys, installs (runtimes, npm and uv tools, ~/.local/bin),
// git config and shell files. SHARED_PARENTS hold kinds' state, never whole. The kit's
// TS validator has the same lists (rules.ts SHARED_HOME, SHARED_HOME_PARENTS;
// state.test.ts compares them). Pure.
object UserStatePaths {
  val SHARED = listOf(
    ProjectDir.NAME,
    ".phonecando",
    ".ssh",
    ".gitconfig",
    ".config/git",
    ".local/bin",
    ".local/lib",
    ".local/opt",
    ".local/share/uv",
    ".profile",
    ".bashrc",
  )

  val SHARED_PARENTS = listOf(".local", ".local/share", ".local/state", ".config", ".cache")

  // The schema's relPath: no leading or trailing slash, no empty, . or ..
  // segment, no backslash or NUL.
  private val REL_PATH = Regex("""^(?!/)(?!.*//)(?!.*/$)(?!(?:.*/)?\.\.?(?:/|$))[^\\\u0000]+$""")

  /** What is wrong with [path] as a userState path; null when nothing is. */
  fun problem(path: String): String? {
    if (!REL_PATH.matches(path)) return "is not a plain path in HOME"
    val shared = SHARED.firstOrNull { within(it, path) || within(path, it) } ?: SHARED_PARENTS.firstOrNull { within(it, path) }
    return shared?.let { "would take $it, which the machine's agents share" }
  }

  private fun within(inner: String, outer: String) = inner == outer || inner.startsWith("$outer/")
}
