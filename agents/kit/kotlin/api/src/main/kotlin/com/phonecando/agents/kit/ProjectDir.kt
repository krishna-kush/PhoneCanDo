package com.phonecando.agents.kit

import java.io.File

// The work folder every agent starts in: `projects` in its machine's HOME,
// so a machine reset keeps it. Not HOME itself: Claude Code never saves a
// folder trust for HOME (it asks on every start) and Aider warns there.
// {{projectDir}} names it; the host makes it before a launch.
object ProjectDir {
  /** The folder's name in HOME. */
  const val NAME = "projects"

  /** The work folder in [home]. */
  fun of(home: File): File = File(home, NAME)

  /** The work folder in [home], as a path (a guest's `/root`, say). */
  fun of(home: String): String = of(File(home)).path
}
