package com.phonecando.lme.api.serve

/** A wire API a model server answers, by [id] and its request [path] under the base URL. */
enum class WireApi(val id: String, val path: String) {
    OPENAI_CHAT("openai-chat", "/v1/chat/completions"),
    OPENAI_RESPONSES("openai-responses", "/v1/responses"),
    ANTHROPIC("anthropic", "/v1/messages"),
}
