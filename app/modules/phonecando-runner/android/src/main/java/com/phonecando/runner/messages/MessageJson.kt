package com.phonecando.runner.messages

import org.json.JSONArray
import org.json.JSONObject

// A message as one line of the log file (MessageStore), and back. A line
// that does not read as a message (no id, no sender) is null; a scheduled
// task's notice keeps its ScheduledNote under `scheduled`. Pure (org.json
// ships with Android; the tests add it).
internal object MessageJson {
  fun write(m: Message): JSONObject = JSONObject()
    .put("id", m.id)
    .put("from", m.from)
    .put("fromName", m.fromName)
    .put("fromKind", m.fromKind ?: JSONObject.NULL)
    .put("fromImage", m.fromImage ?: JSONObject.NULL)
    .put("to", m.to)
    .put("toName", m.toName ?: JSONObject.NULL)
    .put("text", m.text)
    .put("replyTo", m.replyTo ?: JSONObject.NULL)
    .put("sentAt", m.sentAt)
    .put("hop", m.hop)
    .put("wake", m.wake)
    .put("notice", m.notice)
    .put("deliveries", JSONArray(m.deliveries.map(::delivery)))
    .put("scheduled", m.scheduled?.let(::scheduled) ?: JSONObject.NULL)

  fun read(o: JSONObject): Message? {
    val id = o.optLong("id", 0L).takeIf { it > 0 } ?: return null
    val from = o.optString("from").takeIf { it.isNotEmpty() } ?: return null
    val list = o.optJSONArray("deliveries") ?: JSONArray()
    return Message(
      id = id,
      from = from,
      fromName = o.optString("fromName"),
      fromKind = text(o, "fromKind"),
      fromImage = text(o, "fromImage"),
      to = o.optString("to"),
      toName = text(o, "toName"),
      text = o.optString("text"),
      replyTo = if (o.isNull("replyTo")) null else o.optLong("replyTo", 0L).takeIf { it > 0 },
      sentAt = o.optLong("sentAt", 0L),
      hop = o.optInt("hop", 0),
      wake = o.optBoolean("wake", false),
      notice = o.optBoolean("notice", false),
      deliveries = (0 until list.length()).mapNotNull { list.optJSONObject(it)?.let(::delivery) },
      scheduled = o.optJSONObject("scheduled")?.let(::scheduled),
    )
  }

  private fun scheduled(n: ScheduledNote): JSONObject = JSONObject()
    .put("scheduleId", n.scheduleId)
    .put("by", n.by)
    .put("newChat", n.newChat)
    .put("timing", n.timing)

  private fun scheduled(o: JSONObject): ScheduledNote? {
    val id = o.optString("scheduleId").takeIf { it.isNotEmpty() } ?: return null
    return ScheduledNote(id, o.optString("by", ScheduledNote.BY_USER), o.optBoolean("newChat", false), o.optString("timing"))
  }

  private fun delivery(d: Delivery): JSONObject = JSONObject()
    .put("agentId", d.agentId)
    .put("name", d.name)
    .put("status", d.status.wire)
    .put("woke", d.woke)
    .put("reason", d.reason ?: JSONObject.NULL)
    .put("at", d.at)

  private fun delivery(o: JSONObject): Delivery? {
    val agentId = o.optString("agentId").takeIf { it.isNotEmpty() } ?: return null
    return Delivery(
      agentId = agentId,
      name = o.optString("name"),
      status = DeliveryStatus.of(o.optString("status")),
      woke = o.optBoolean("woke", false),
      reason = text(o, "reason"),
      at = o.optLong("at", 0L),
    )
  }

  private fun text(o: JSONObject, key: String): String? = if (o.isNull(key)) null else o.optString(key).ifEmpty { null }
}
