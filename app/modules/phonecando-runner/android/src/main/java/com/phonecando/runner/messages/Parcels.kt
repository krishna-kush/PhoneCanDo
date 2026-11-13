package com.phonecando.runner.messages

import com.phonecando.runner.messages.delivery.Parcel

// What one hand-over carries: hook runners cut long context (one cuts at
// 10 KB, another spills past ~2,500 tokens to a file), and a message the
// hook printed counts as read. So a parcel takes an agent's oldest unread
// messages while their blocks fit in MAX_BYTES of UTF-8 (always at least
// one: one message is at most 4000 characters), and when some are held
// back its text ends with how many still wait; the next hook, or
// agents_inbox, gets them. The parcel may wake the agent when any of its
// unread messages may. A scheduled task in it that asks for a new chat
// names that chat (Parcel.newChat). Pure.
object Parcels {
  const val MAX_BYTES = 8 * 1024

  fun build(
    unread: List<Message>,
    readerImage: String?,
    kindLabel: (String) -> String,
    mayWake: (Message) -> Boolean,
  ): Parcel {
    require(unread.isNotEmpty()) { "nothing to hand over" }
    var take = 1
    var size = bytes(Renderer.block(unread[0], readerImage, kindLabel))
    while (take < unread.size) {
      val next = bytes(Renderer.block(unread[take], readerImage, kindLabel)) + SEPARATOR
      if (size + next > MAX_BYTES) break
      size += next
      take++
    }
    val batch = unread.take(take)
    val held = unread.size - take
    val text = Renderer.render(batch, readerImage, kindLabel) + if (held > 0) "\n\n${more(held)}" else ""
    return Parcel(
      ids = batch.map { it.id },
      text = text,
      jsonl = MessageReplies.jsonl(batch, readerImage, kindLabel),
      wake = unread.any(mayWake),
      newChat = batch.firstOrNull { it.scheduled?.newChat == true }?.let { it.scheduled?.chatTitle(it.text) },
    )
  }

  fun more(held: Int): String =
    if (held == 1) "1 more agent message waiting: call agents_inbox." else "$held more agent messages waiting: call agents_inbox."

  private fun bytes(text: String) = text.toByteArray(Charsets.UTF_8).size

  private const val SEPARATOR = 2
}
