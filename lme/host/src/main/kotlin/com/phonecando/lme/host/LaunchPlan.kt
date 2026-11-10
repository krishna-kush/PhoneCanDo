package com.phonecando.lme.host

import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.lme.host.ram.RamVerdict

/**
 * How to start one model server: [argv] (the executable first) with [env]
 * added to the host's environment. The server is ready when [healthUrl]
 * says so ([com.phonecando.lme.host.health.Readiness]); then [endpoint] is
 * what agents use. [env] holds the API key, so [toString] shows its names
 * only.
 *
 * @property contextSize the context it starts with (the endpoint's
 *   context window)
 * @property promptCacheMiB the cap on its prompt cache in RAM, 0 for none
 * @property ram the verdict the plan passed: [RamVerdict.Tight] means the
 *   UI should warn before starting, [RamVerdict.OverBudget] that a chosen
 *   context takes more than the budget
 */
data class LaunchPlan(
    val argv: List<String>,
    val env: Map<String, String>,
    val healthUrl: String,
    val endpoint: ServedEndpoint,
    val contextSize: Long,
    val promptCacheMiB: Long,
    val threads: Int,
    val ram: RamVerdict,
) {
    override fun toString(): String =
        "LaunchPlan(argv=$argv, env=${env.keys}, healthUrl=$healthUrl, endpoint=$endpoint, " +
            "contextSize=$contextSize, promptCacheMiB=$promptCacheMiB, threads=$threads, ram=$ram)"
}
