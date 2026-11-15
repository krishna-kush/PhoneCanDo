package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.AcpSpec
import com.phonecando.agents.kit.manifest.Command
import kotlinx.serialization.json.JsonObject

// A tui kind's ACP mode in a launch (`engine.acp`): its own argv in the
// launch's cwd with the launch's env, so it renders through the same
// pipeline as the terminal launch (ManifestKind: the state env, the model,
// the image's sh); its own env goes on top of all that, and its meta is
// filled with the same values the launch's env sees. Pure.
object AcpSeam {
  /** The command ACP mode runs: its own argv, with the launch's env and cwd. */
  fun command(acp: AcpSpec, launch: Command): Command = Command(acp.argv, launch.env, launch.cwd)

  /** Its own env, rendered with a launch's [values] (LaunchRenderer.values), in manifest order. */
  fun env(acp: AcpSpec, values: Map<String, String>): Map<String, String> = Templates.env(acp.env, values)

  /** [meta] with each string filled from a launch's [values], as compact JSON. */
  fun meta(meta: JsonObject, values: Map<String, String>): String = JsonTemplates.fill(meta, values).toString()
}
