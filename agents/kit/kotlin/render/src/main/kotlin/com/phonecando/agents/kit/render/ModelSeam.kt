package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchSpec
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.manifest.ModelWiring

// A local model in a launch: the first API of the kind's `models` (its
// preference) that the model server serves, rendered for that server. Its
// args go right after the program (global flags come before a subcommand or
// the resume args), its env after the kind's own. Pure.
object ModelSeam {
  /** The wiring to use with a server serving [served]; null when the kind speaks none of them. */
  fun pick(wirings: List<ModelWiring>, served: List<String>): ModelWiring? = wirings.firstOrNull { it.api in served }

  fun apply(spec: LaunchSpec, wiring: ModelWiring, endpoint: ModelEndpoint): LaunchSpec {
    val values = mapOf(
      "baseUrl" to endpoint.baseUrl,
      "model" to endpoint.model,
      "contextWindow" to endpoint.contextWindow.toString(),
      "modelKey" to endpoint.key,
    )
    val args = wiring.args.map { Templates.render(it, values) }
    return spec.copy(
      argv = spec.argv.take(1) + args + spec.argv.drop(1),
      env = spec.env + Templates.env(wiring.env, values),
    )
  }
}
