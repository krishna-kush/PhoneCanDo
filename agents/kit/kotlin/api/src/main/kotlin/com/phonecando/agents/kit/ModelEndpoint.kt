package com.phonecando.agents.kit

/**
 * A model server an agent can use, as the host hands it to a launch: where
 * it listens, the model's id, the server's key, the context it was started
 * with and the wire APIs it serves ("openai-chat", "openai-responses",
 * "anthropic"). The kind's `models` block says what to do with it.
 */
data class ModelEndpoint(
  val baseUrl: String,
  val model: String,
  val key: String,
  val contextWindow: Int,
  val apis: List<String>,
) {
  /** Without the key, so a log line or a crash report never carries it. */
  override fun toString(): String = "ModelEndpoint(baseUrl=$baseUrl, model=$model, key=<hidden>, contextWindow=$contextWindow, apis=$apis)"
}
