package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchSpec
import com.phonecando.agents.kit.manifest.StateFolder
import java.io.File

// An agent's own state folder in a launch (the manifest's `state`): its env
// rendered with {{stateDir}} the folder as the program sees it, after the
// kind's own env (or its TUI client's), so a name in both takes the
// agent's. A native kind's program sees the host path; an image kind's the
// guest one, the folder's path in the image home under
// ImageLaunch.GUEST_HOME, where the image binds it (as {{projectDir}} is).
// Pure.
object StateSeam {
  fun apply(spec: LaunchSpec, state: StateFolder, stateDir: String): LaunchSpec = spec.copy(env = spec.env + env(state, stateDir))

  /** [state]'s env, in manifest order, with [stateDir] the folder as the program sees it. */
  fun env(state: StateFolder, stateDir: String): Map<String, String> = Templates.env(state.env, mapOf("stateDir" to stateDir))

  /** [stateDir], a folder in the image home [home] (host paths), as the guest names it; throws when it lies outside. */
  fun guestPath(stateDir: File, home: File): String {
    val rel = stateDir.normalize().relativeToOrNull(home.normalize())?.path
    if (rel == null || rel == ".." || rel.startsWith("../")) {
      throw KindException("the state folder $stateDir is not in the image home $home")
    }
    return if (rel.isEmpty()) ImageLaunch.GUEST_HOME else "${ImageLaunch.GUEST_HOME}/$rel"
  }
}
