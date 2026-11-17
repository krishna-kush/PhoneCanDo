package com.phonecando.runner.schedule.reply

import com.phonecando.runner.engine.acp.AcpItem
import com.phonecando.runner.schedule.ScheduleRules

// A scheduled run's reply as its run keeps it (ScheduleRun.reply): the
// agent's final answer, trimmed, at most REPLY_MAX characters, the last of
// them "…" when cut. An ACP turn's answer is what it said after its last
// step (a tool call, a thought or its plan): the text items after the last
// other item, joined; when it said nothing after, its last text. Pure.
object RunReply {
  fun ofAcp(items: List<AcpItem>): String? {
    val lastStep = items.indexOfLast { it !is AcpItem.Text }
    val answer = items.drop(lastStep + 1)
      .filterIsInstance<AcpItem.Text>()
      .map { it.text.trim() }
      .filter { it.isNotEmpty() }
      .joinToString("\n\n")
      .ifEmpty { null }
      ?: items.filterIsInstance<AcpItem.Text>().lastOrNull { it.text.isNotBlank() }?.text
    return cap(answer)
  }

  /** [text] trimmed and cut to REPLY_MAX; null when blank. */
  fun cap(text: String?): String? {
    val reply = text?.trim()?.ifEmpty { null } ?: return null
    if (reply.length <= ScheduleRules.REPLY_MAX) return reply
    var end = ScheduleRules.REPLY_MAX - 1
    // Never half a surrogate pair.
    if (Character.isHighSurrogate(reply[end - 1])) end--
    return reply.substring(0, end).trimEnd() + "…"
  }
}
