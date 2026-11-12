package com.phonecando.runner.messages

// A message as the app reads it (NativeMessage in the module's TS types):
//   {id, from:{agentId|null, name, kind|null},
//    to:{kind:"agent"|"machine"|"phone", agentId?, name?, imageId?},
//    text, replyTo, sentAt, hop, notice,
//    deliveries:[{agentId, name, status, woke, reason?}]}
// A runner notice is from agentId null, name "PhoneCanDo". Names are the
// ones the agents had when it was sent; kind is the sender's kind id.
// Numbers are doubles, as the bridge to JS passes them. Pure.
object MessageJs {
  fun of(m: Message): Map<String, Any?> = mapOf(
    "id" to m.id.toDouble(),
    "from" to mapOf(
      "agentId" to if (m.notice) null else m.from,
      "name" to if (m.notice) Message.RUNNER_NAME else m.fromName,
      "kind" to m.fromKind,
    ),
    "to" to to(m),
    "text" to m.text,
    "replyTo" to m.replyTo?.toDouble(),
    "sentAt" to m.sentAt.toDouble(),
    "hop" to m.hop,
    "notice" to m.notice,
    "deliveries" to m.deliveries.map { d ->
      buildMap {
        put("agentId", d.agentId)
        put("name", d.name)
        put("status", d.status.wire)
        put("woke", d.woke)
        d.reason?.let { put("reason", it) }
      }
    },
  )

  private fun to(m: Message): Map<String, Any?> {
    val machine = Message.machineOf(m.to)
    return when {
      m.to == Message.PHONE -> mapOf("kind" to "phone")
      machine != null -> mapOf("kind" to "machine", "imageId" to machine)
      else -> mapOf("kind" to "agent", "agentId" to m.to, "name" to m.toName)
    }
  }
}
