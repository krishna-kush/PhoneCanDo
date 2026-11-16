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
 * @property totalBytes what it holds once that cache fills: its weights
 *   (file pages read in place and copies), its compute buffer, the slot's
 *   state (KV cache, recurrent state, context checkpoints) and the prompt
 *   cache
 * @property heldBytes [totalBytes] less the file pages it reads in place:
 *   what the running server takes from free memory (the files are mapped
 *   from storage, so Android counts their pages as free to reclaim)
 * @property ram the verdict the plan passed: [RamVerdict.Tight] means the
 *   UI should warn before starting, [RamVerdict.OverBudget] that a chosen
 *   context takes more than the budget
 * @property halfKvCache its KV cache is 8-bit
 * @property measured it counts the server's own measurement on this phone;
 *   false: an estimate
 * @property storedChats the chats kept on storage at most (its argv has
 *   `--slot-save-path`); 0: chats stay in its prompt cache in RAM
 * @property promptBytes one prompt's state at [contextSize]: the most a
 *   saved chat takes
 * @property checkpoints its context checkpoints; null when it gets none
 */
data class LaunchPlan(
    val argv: List<String>,
    val env: Map<String, String>,
    val healthUrl: String,
    val endpoint: ServedEndpoint,
    val contextSize: Long,
    val promptCacheMiB: Long,
    val totalBytes: Long,
    val heldBytes: Long,
    val threads: Int,
    val ram: RamVerdict,
    val halfKvCache: Boolean = false,
    val measured: Boolean = false,
    val storedChats: Int = 0,
    val promptBytes: Long = 0,
    val checkpoints: Int? = null,
) {
    override fun toString(): String =
        "LaunchPlan(argv=$argv, env=${env.keys}, healthUrl=$healthUrl, endpoint=$endpoint, " +
            "contextSize=$contextSize, promptCacheMiB=$promptCacheMiB, totalBytes=$totalBytes, heldBytes=$heldBytes, threads=$threads, ram=$ram, " +
            "halfKvCache=$halfKvCache, measured=$measured, storedChats=$storedChats, promptBytes=$promptBytes, checkpoints=$checkpoints)"
}
