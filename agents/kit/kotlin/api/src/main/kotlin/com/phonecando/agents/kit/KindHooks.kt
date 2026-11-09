package com.phonecando.agents.kit

/**
 * The code a bundled kind needs where its agent.json cannot say it, by hook
 * id. The manifest names each hook it uses (`hooks`, and an `sse` event's
 * `parser`); agents/builtin registers one KindHooks per kind that has any.
 * A kind whose manifest names a hook its KindHooks lacks is not loaded.
 */
interface KindHooks {
  /** The kind's id (its folder and its agent.json `id`). */
  val id: String

  /** Turns one `data:` frame of the named SSE stream into an EngineEvent (null: nothing we read). */
  fun sseParser(name: String): ((String) -> EngineEvent?)? = null
}
