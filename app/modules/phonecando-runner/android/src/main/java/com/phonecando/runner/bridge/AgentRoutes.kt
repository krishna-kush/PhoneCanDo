package com.phonecando.runner.bridge

import com.phonecando.runner.messages.AgentsView
import com.phonecando.runner.messages.Directory
import com.phonecando.runner.messages.Mailbox
import com.phonecando.runner.messages.MessageReplies
import com.phonecando.runner.messages.MessageRules
import org.json.JSONObject

// The agents_* tools' routes (messages between agents; messages/ has the
// rules), each a POST with a JSON body, on every channel, neither gated nor
// a screen route:
//   /agents/list  {scope?: "machine"|"phone"}        who is here (Directory)
//   /agents/send  {to, text, replyTo?, wake?}         {id, results:[{to, status, reason?}]}
//   /agents/inbox {limit?}                            {messages, more, note?}, now read
//   /agents/wait  {from?, timeoutSec?}                the first new message as inbox, or {timeout: true}
// The caller is the bearer's agent. A wait holds its request's own thread
// (NanoHTTPD runs one per connection) for at most WAIT_MAX_SEC, so it never
// holds up another agent's call. A missing or mistyped argument is 400
// bad_request; a refused send is the send's result, not an error. Pure.
class AgentRoutes(private val mailbox: Mailbox, private val view: AgentsView) {
  fun table(): Map<Route, RouteHandler> = mapOf(
    Route.AGENTS_LIST to ::list,
    Route.AGENTS_SEND to ::send,
    Route.AGENTS_INBOX to ::inbox,
    Route.AGENTS_WAIT to ::wait,
  )

  private fun list(call: BridgeCall): Reply {
    val scope = optText(call.body, "scope") ?: return wrongType("scope")
    return Reply.ok(Directory.list(call.agent, Directory.scope(scope.ifEmpty { null }), view, mailbox.policy::wakesLeft))
  }

  private fun send(call: BridgeCall): Reply {
    val to = (call.body.opt("to") as? String)?.takeIf { it.isNotBlank() }
      ?: return Reply.badRequest(BAD, "to is required: an agent's name, @machine or @phone")
    val text = call.body.opt("text") as? String ?: return Reply.badRequest(BAD, "text is required")
    val replyTo = when (val r = call.body.opt("replyTo")) {
      null, JSONObject.NULL -> null
      is Number -> r.toLong()
      else -> return wrongType("replyTo")
    }
    val wake = when (val w = call.body.opt("wake")) {
      null, JSONObject.NULL -> false
      is Boolean -> w
      else -> return wrongType("wake")
    }
    val result = mailbox.send(call.agent, to, text, replyTo, wake)
    return Reply.ok(MessageReplies.sent(result.id, result.results))
  }

  private fun inbox(call: BridgeCall): Reply {
    val limit = optNumber(call.body, "limit") ?: return wrongType("limit")
    val n = if (limit.isNaN()) MessageRules.INBOX_DEFAULT else limit.toInt().coerceIn(1, MessageRules.INBOX_MAX)
    val taken = mailbox.inbox(call.agent, n)
    return Reply.ok(MessageReplies.inbox(taken.messages, taken.more, call.agent.imageId, view::kindLabel))
  }

  private fun wait(call: BridgeCall): Reply {
    val from = optText(call.body, "from") ?: return wrongType("from")
    val timeout = optNumber(call.body, "timeoutSec") ?: return wrongType("timeoutSec")
    val sec = if (timeout.isNaN()) MessageRules.WAIT_MAX_SEC.toDouble() else timeout.coerceIn(0.0, MessageRules.WAIT_MAX_SEC.toDouble())
    return when (val waited = mailbox.wait(call.agent, from.ifEmpty { null }, (sec * 1000).toLong())) {
      is Mailbox.Waited.Got ->
        Reply.ok(MessageReplies.inbox(waited.taken.messages, waited.taken.more, call.agent.imageId, view::kindLabel))
      Mailbox.Waited.TimedOut -> Reply.ok(MessageReplies.timeout())
      is Mailbox.Waited.Refused -> Reply.fail("unknown_agent", waited.reason)
    }
  }

  // "" when absent or null; null when it is there and not a string.
  private fun optText(body: JSONObject, key: String): String? = when (val v = body.opt(key)) {
    null, JSONObject.NULL -> ""
    is String -> v
    else -> null
  }

  // NaN when absent or null; null when it is there and not a finite number.
  private fun optNumber(body: JSONObject, key: String): Double? = when (val v = body.opt(key)) {
    null, JSONObject.NULL -> Double.NaN
    is Number -> v.toDouble().takeIf { it.isFinite() }
    else -> null
  }

  private fun wrongType(key: String) = Reply.badRequest(BAD, "$key has the wrong type")

  private companion object {
    const val BAD = "bad_request"
  }
}
