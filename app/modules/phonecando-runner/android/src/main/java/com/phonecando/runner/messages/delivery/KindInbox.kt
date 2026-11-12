package com.phonecando.runner.messages.delivery

import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.InboxRequest
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.agents.kit.render.ManifestKind

// A kind's manifest `inbox` block (kit ManifestKind.inbox, renderInboxHook,
// inboxRequest, inboxLatestRequest/Id) as an InboxPlan: the one place messaging meets the kit's
// inbox API. Null for a kind without the block (it only pulls).
class KindInbox private constructor(private val kind: ManifestKind) : InboxPlan {
  private val spec = checkNotNull(kind.inbox)

  override val hooks: Map<String, Int> = spec.hooks.mapValues { it.value.exit }
  override val reader: Boolean get() = spec.reader
  override val server: Boolean get() = spec.server != null
  override val wakesByServer: Boolean get() = spec.wake == InboxWake.SERVER && spec.server?.wake != null

  override fun hookOutput(event: String, text: String): String = kind.renderInboxHook(event, text)

  override fun request(call: InboxCall, port: String, password: String, sessionId: String, text: String): InboxRequest? =
    kind.inboxRequest(call, port, password, sessionId, text)

  override fun latestRequest(port: String, password: String): InboxRequest? = kind.inboxLatestRequest(port, password)

  override fun latestId(answer: String): String? = kind.inboxLatestId(answer)

  companion object {
    fun of(kind: ManifestKind): KindInbox? = if (kind.inbox == null) null else KindInbox(kind)
  }
}
