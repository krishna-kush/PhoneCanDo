package com.phonecando.runner.models.prompt

import org.json.JSONArray

// The model server reading a request's prompt, for the app (the
// phonecandoPromptReading event, promptReading) and the service
// notification. Read from the pinned llama-server's GET /slots
// (lme/llamacpp/pins.env): a slot that is processing and has decoded no
// token yet is reading. Its `n_prompt_tokens_processed` counts the new
// prompt tokens read so far (reset at each request, grown once per decoded
// batch, 2048 tokens by default) and `n_prompt_tokens_cache` those its
// cache already held. `n_prompt_tokens_total` is the request's whole prompt
// (our patch, lme/llamacpp/patches/0002-slot-prompt-total.patch; upstream's
// `n_prompt_tokens` is only what the slot holds so far), so the new tokens
// to read in all are that less the cache. Pure.
data class PromptReading(
  val modelId: String,
  val modelName: String,
  /** The agents the server is busy for: bound to it, with a run going. */
  val agentIds: List<String>,
  /** New prompt tokens read so far. */
  val read: Long,
  /** Tokens the server's prompt cache already held. */
  val cached: Long,
  /** New prompt tokens to read in all (the whole prompt less [cached]); null when the server does not say. */
  val total: Long?,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "modelId" to modelId,
    "modelName" to modelName,
    "agentIds" to agentIds,
    "read" to read.toDouble(),
    "cached" to cached.toDouble(),
    "total" to total?.toDouble(),
  )

  /** What one /slots answer says of the slot that reads. */
  data class Slot(val read: Long, val cached: Long, val total: Long?)

  companion object {
    /** The slot reading a prompt in a /slots body; null when none is (idle, writing its reply) or the body is not one. */
    fun readingSlot(body: String): Slot? {
      val slots = try {
        JSONArray(body)
      } catch (_: Exception) {
        return null
      }
      for (i in 0 until slots.length()) {
        val slot = slots.optJSONObject(i) ?: continue
        if (!slot.optBoolean("is_processing", false)) continue
        val decoded = slot.optJSONArray("next_token")?.optJSONObject(0)?.optLong("n_decoded", 0L) ?: 0L
        if (decoded > 0) continue
        val cached = slot.optLong("n_prompt_tokens_cache", 0L)
        val whole = slot.optLong("n_prompt_tokens_total", 0L)
        return Slot(slot.optLong("n_prompt_tokens_processed", 0L), cached, (whole - cached).takeIf { whole > 0 && it > 0 })
      }
      return null
    }
  }
}
