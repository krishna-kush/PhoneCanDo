package com.phonecando.runner.engine.acp

/**
 * One thing an ACP turn shows (AcpTurn folds the agent's session/update
 * notices into these): its text and its thinking, each message merged from
 * its chunks, a tool step with its latest title and status, and its plan.
 * [toMap] is what JS gets: `{id, type, text?, title?, kind?, status?, entries?}`.
 */
sealed interface AcpItem {
  val id: String

  fun toMap(): Map<String, Any?>

  data class Text(override val id: String, val text: String) : AcpItem {
    override fun toMap(): Map<String, Any?> = mapOf("id" to id, "type" to "text", "text" to text)
  }

  data class Thought(override val id: String, val text: String) : AcpItem {
    override fun toMap(): Map<String, Any?> = mapOf("id" to id, "type" to "thought", "text" to text)
  }

  /** [kind]: read, edit, execute… as the agent names it; [status]: pending, in_progress, completed or failed. */
  data class Tool(override val id: String, val title: String, val kind: String?, val status: String?) : AcpItem {
    override fun toMap(): Map<String, Any?> = mapOf("id" to id, "type" to "tool", "title" to title, "kind" to kind, "status" to status)
  }

  data class Plan(override val id: String, val entries: List<String>) : AcpItem {
    override fun toMap(): Map<String, Any?> = mapOf("id" to id, "type" to "plan", "entries" to entries)
  }
}
