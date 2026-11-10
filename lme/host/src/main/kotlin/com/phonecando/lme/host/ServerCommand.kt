package com.phonecando.lme.host

import com.phonecando.lme.api.serve.ServedEndpoint

/**
 * One model server's command: [argv] (the executable first) with [env]
 * added to the host's environment, up when [healthUrl] says so, then
 * [endpoint] for agents. What a [LaunchPlan] runs once the device and RAM
 * checks pass; on its own, what lme-cli prints for a CI host. [env] holds
 * the API key, so [toString] shows its names only.
 */
data class ServerCommand(
    val argv: List<String>,
    val env: Map<String, String>,
    val healthUrl: String,
    val endpoint: ServedEndpoint,
    val contextSize: Long,
) {
    override fun toString(): String =
        "ServerCommand(argv=$argv, env=${env.keys}, healthUrl=$healthUrl, endpoint=$endpoint, contextSize=$contextSize)"
}
