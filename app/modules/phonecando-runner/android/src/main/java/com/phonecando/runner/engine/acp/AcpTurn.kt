package com.phonecando.runner.engine.acp

import org.json.JSONObject

// What one ACP turn shows, folded from the agent's session/update notices
// (AcpItem): message and thought chunks merge into one item per message
// (by its messageId when the agent sends one, else into the item before
// when it is of the same type), a tool call and its updates are one item
// (fields an update leaves out keep their last value), a plan replaces
// the last one. Text that is no text block (an image, a resource) and
// every other update (commands, modes, usage, the user's own message) shows
// nothing. A turn keeps at most [maxItems] items and [maxChars] characters
// of text: past that the oldest items go, and a single message too long
// keeps its end. Not thread-safe; pure.
internal class AcpTurn(
  private val maxItems: Int = MAX_ITEMS,
  private val maxChars: Int = MAX_TEXT_CHARS,
) {
  private val items = LinkedHashMap<String, AcpItem>()
  private var next = 0

  fun clear() {
    items.clear()
  }

  fun items(): List<AcpItem> = items.values.toList()

  /** The item [update] made or changed, as kept; null when it shows nothing. */
  fun onUpdate(update: JSONObject): AcpItem? {
    val changed = when (update.textOf("sessionUpdate")) {
      MESSAGE -> chunk(update, thought = false)
      THOUGHT -> chunk(update, thought = true)
      TOOL_CALL, TOOL_CALL_UPDATE -> tool(update)
      PLAN -> plan(update)
      else -> null
    } ?: return null
    trim()
    return items[changed]
  }

  private fun chunk(update: JSONObject, thought: Boolean): String? {
    val content = update.optJSONObject("content") ?: return null
    if (content.textOf("type") != "text") return null
    val text = content.textOf("text") ?: return null
    val prefix = if (thought) "t" else "m"
    val messageId = update.textOf("messageId")
    val last = items.values.lastOrNull()
    val id = when {
      messageId != null -> "$prefix:$messageId"
      thought && last is AcpItem.Thought -> last.id
      !thought && last is AcpItem.Text -> last.id
      else -> "$prefix${++next}"
    }
    val before = when (val item = items[id]) {
      is AcpItem.Text -> item.text
      is AcpItem.Thought -> item.text
      else -> ""
    }
    items[id] = if (thought) AcpItem.Thought(id, before + text) else AcpItem.Text(id, before + text)
    return id
  }

  private fun tool(update: JSONObject): String? {
    val id = "tool:" + (update.textOf("toolCallId") ?: return null)
    val was = items[id] as? AcpItem.Tool
    items[id] = AcpItem.Tool(
      id = id,
      title = update.textOf("title") ?: was?.title.orEmpty(),
      kind = update.textOf("kind") ?: was?.kind,
      status = update.textOf("status") ?: was?.status,
    )
    return id
  }

  private fun plan(update: JSONObject): String? {
    val entries = update.optJSONArray("entries") ?: return null
    val texts = (0 until entries.length()).mapNotNull { entries.optJSONObject(it)?.textOf("content") }
    items[PLAN_ID] = AcpItem.Plan(PLAN_ID, texts)
    return PLAN_ID
  }

  private fun trim() {
    while (items.size > maxItems) dropOldest()
    while (chars() > maxChars && items.size > 1) dropOldest()
    val only = items.values.firstOrNull() ?: return
    val over = chars() - maxChars
    if (over <= 0) return
    items[only.id] = when (only) {
      is AcpItem.Text -> only.copy(text = only.text.substring(over))
      is AcpItem.Thought -> only.copy(text = only.text.substring(over))
      else -> only
    }
  }

  private fun dropOldest() {
    items.remove(items.keys.first())
  }

  private fun chars(): Int = items.values.sumOf {
    when (it) {
      is AcpItem.Text -> it.text.length
      is AcpItem.Thought -> it.text.length
      else -> 0
    }
  }

  companion object {
    const val MAX_ITEMS = 200
    const val MAX_TEXT_CHARS = 64 * 1024

    private const val MESSAGE = "agent_message_chunk"
    private const val THOUGHT = "agent_thought_chunk"
    private const val TOOL_CALL = "tool_call"
    private const val TOOL_CALL_UPDATE = "tool_call_update"
    private const val PLAN = "plan"
    private const val INFO = "session_info_update"
    private const val PLAN_ID = "plan"

    /** The chat's new title when [update] names one (session_info_update); null otherwise. */
    fun titleOf(update: JSONObject): String? =
      if (update.textOf("sessionUpdate") == INFO) update.textOf("title") else null
  }
}
