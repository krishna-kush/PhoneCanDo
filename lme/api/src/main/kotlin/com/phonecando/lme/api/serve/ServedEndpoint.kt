package com.phonecando.lme.api.serve

/**
 * A model server up on loopback: what an agent needs to talk to it.
 *
 * @property baseUrl `http://127.0.0.1:<port>`, no trailing slash; each
 *   [WireApi.path] goes under it
 * @property model the model name the server answers to
 * @property key the per-boot API key, sent as `Authorization: Bearer` (or
 *   `x-api-key` for [WireApi.ANTHROPIC]); never logged, so [toString]
 *   leaves it out
 * @property contextWindow the context size the server was started with
 */
data class ServedEndpoint(
    val baseUrl: String,
    val model: String,
    val key: String,
    val contextWindow: Long,
    val apis: Set<WireApi>,
) {
    override fun toString(): String =
        "ServedEndpoint(baseUrl=$baseUrl, model=$model, key=<hidden>, contextWindow=$contextWindow, apis=$apis)"
}
