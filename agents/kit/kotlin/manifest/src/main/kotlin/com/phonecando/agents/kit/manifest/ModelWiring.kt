package com.phonecando.agents.kit.manifest

/**
 * How a kind takes a local model over one wire API (`models.<api>`): the env
 * it sets and the args that go right after its program, both unrendered
 * ({{baseUrl}}, {{model}}, {{contextWindow}}; {{modelKey}} in env only).
 */
data class ModelWiring(val api: String, val env: Map<String, String>, val args: List<String>) {
  companion object {
    /** The wire APIs a model server may serve (agents/kit/ts/manifest/rules.ts MODEL_APIS). */
    val APIS = listOf("openai-chat", "openai-responses", "anthropic")
  }
}
