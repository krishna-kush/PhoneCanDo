package com.phonecando.runner.messages.delivery

import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.InboxRequest
import com.phonecando.runner.agents.AgentRecord
import java.util.concurrent.ConcurrentHashMap

/** A running server engine's way in: its port, password, and the chat to post to (null: none known yet). */
data class ServerSeat(val port: String, val password: String, val sessionId: String?)

// Hands an agent its messages the way its kind's `inbox` says (InboxPlan):
// - hooks or a reader: the whole undelivered set into its inbox folder's
//   pending/ (InboxFolder), with what each hook event prints and its exit
//   code, and the wake mark when they may wake it; they stay queued until
//   its hook or reader writes the `@inbox` receipt (or it calls
//   agents_inbox). A set claimed before its receipt was read (the
//   pending/ we wrote is gone, or its ids are in a claimed.* folder) is
//   found by [claimed], so the next write leaves it out.
// - a server: posted to the engine's own loopback server with its password,
//   into its working chat, else its latest (ServerSeat), else the newest the
//   engine itself lists (`inbox.server.latest`): the wake call when
//   they may wake it and the kind wakes through its server, else deliver.
//   A 2xx is delivered (WOKE or POSTED), and pending/ goes. No chat known
//   yet, no engine, or a failure: they stay queued, and a retry (an engine
//   start, a chat showing up) waits RETRY_MS after a failure.
// - no `inbox` block: nothing; the agent pulls with agents_inbox.
// IO through the injected folder, seat and post.
class InboxCourier(
  private val plan: (AgentRecord) -> InboxPlan?,
  private val folder: (AgentRecord) -> InboxFolder?,
  private val seat: (AgentRecord) -> ServerSeat?,
  private val post: (InboxRequest) -> Int = { it.send(CONNECT_MS, READ_MS) },
  private val clock: () -> Long = System::currentTimeMillis,
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
  private val fetch: (InboxRequest) -> Pair<Int, String> = { it.exchange(CONNECT_MS, READ_MS) },
) : Courier {
  // The ids of the set last written to each agent's pending/.
  private val written = ConcurrentHashMap<String, List<Long>>()
  private val failedAt = ConcurrentHashMap<String, Long>()

  override fun claimed(agent: AgentRecord): Set<Long> {
    val inbox = folder(agent) ?: return emptySet()
    val out = HashSet(inbox.inFlight())
    val ids = written[agent.id]
    if (ids != null && !inbox.hasPending()) {
      written.remove(agent.id)
      out += ids
    }
    return out
  }

  override fun handOver(agent: AgentRecord, parcel: Parcel, retry: Boolean): Handover {
    val p = plan(agent) ?: return Handover.NONE
    var result = Handover.NONE
    if (p.folder) {
      folder(agent)?.let { inbox ->
        inbox.write(files(p, parcel), parcel.wake)
        written[agent.id] = parcel.ids
        result = Handover.HELD
      }
    }
    if (p.server) {
      serve(agent, p, parcel, retry)?.let { posted ->
        if (p.folder) clear(agent)
        return posted
      }
    }
    return result
  }

  // POSTED or WOKE when the engine took them; null when it did not, or could not be asked.
  private fun serve(agent: AgentRecord, p: InboxPlan, parcel: Parcel, retry: Boolean): Handover? {
    if (retry && failedAt[agent.id]?.let { clock() - it < RETRY_MS } == true) return null
    val s = seat(agent) ?: return null
    val sessionId = s.sessionId ?: newestChat(agent, p, s) ?: return null
    val waking = parcel.wake && p.wakesByServer
    val call = if (waking) InboxCall.WAKE else InboxCall.DELIVER
    val request = p.request(call, s.port, s.password, sessionId, parcel.text) ?: return null
    val status = try {
      post(request)
    } catch (e: Exception) {
      onError("inbox post to ${agent.id} failed", e)
      -1
    }
    if (status in 200..299) {
      failedAt.remove(agent.id)
      return if (waking) Handover.WOKE else Handover.POSTED
    }
    failedAt[agent.id] = clock()
    return null
  }

  // No chat of the agent's has run since its engine started, so the chat
  // board knows none: ask the engine for its newest (`inbox.server.latest`).
  private fun newestChat(agent: AgentRecord, p: InboxPlan, s: ServerSeat): String? {
    val request = p.latestRequest(s.port, s.password) ?: return null
    return try {
      val (status, answer) = fetch(request)
      if (status in 200..299) p.latestId(answer) else null
    } catch (e: Exception) {
      onError("newest chat of ${agent.id} not read", e)
      null
    }
  }

  override fun clear(agent: AgentRecord) {
    written.remove(agent.id)
    folder(agent)?.clear()
  }

  override fun prepare(agent: AgentRecord) {
    written.remove(agent.id)
    failedAt.remove(agent.id)
    folder(agent)?.prepare()
  }

  override fun forget(agentId: String) {
    written.remove(agentId)
    failedAt.remove(agentId)
  }

  companion object {
    const val CONNECT_MS = 1_000
    const val READ_MS = 5_000

    /** After a failed post, a retry waits this long (a new message does not). */
    const val RETRY_MS = 15_000L

    /** pending/'s files for [parcel] (InboxFolder has the layout); a hook event that is no safe file name is left out. */
    fun files(p: InboxPlan, parcel: Parcel): Map<String, String> {
      val out = linkedMapOf(
        InboxFolder.IDS to parcel.ids.joinToString("\n", postfix = "\n"),
        InboxFolder.JSONL to parcel.jsonl,
        InboxFolder.TEXT to parcel.text,
      )
      for ((event, exit) in p.hooks) {
        if (!InboxFolder.safeName(event)) continue
        out[event + InboxFolder.OUT] = p.hookOutput(event, parcel.text)
        if (exit != 0) out[event + InboxFolder.EXIT] = "$exit\n"
      }
      return out
    }
  }
}
