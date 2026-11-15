package com.phonecando.runner.engine.acp

import org.json.JSONArray
import org.json.JSONObject

// The Agent Client Protocol on an agent's stdin and stdout: JSON-RPC 2.0,
// one message per line (org.json never puts a newline in one). Our requests
// carry numeric ids. What we send: initialize (we offer no file system, no
// terminal and no sign-in through one), session/new, session/load and
// session/resume (each with the chat's folder, the MCP servers it gets and
// the kind's `_meta`), session/list, session/set_config_option,
// session/prompt (one text block) and session/cancel; the answer to a
// permission question (an option, or cancelled); and "not offered" to any
// other request the agent makes (fs/*, terminal/*, elicitation/*). The
// phone tools' MCP server is our bridge's /mcp with the agent's token as a
// bearer header. Pure.
internal object AcpWire {
  const val PROTOCOL_VERSION = 1

  const val INITIALIZE = "initialize"
  const val SESSION_NEW = "session/new"
  const val SESSION_LOAD = "session/load"
  const val SESSION_RESUME = "session/resume"
  const val SESSION_LIST = "session/list"
  const val SET_CONFIG_OPTION = "session/set_config_option"
  const val PROMPT = "session/prompt"
  const val CANCEL = "session/cancel"
  const val UPDATE = "session/update"
  const val REQUEST_PERMISSION = "session/request_permission"

  const val METHOD_NOT_FOUND = -32601

  /** ACP's "sign in first" (auth_required). */
  const val AUTH_REQUIRED = -32000

  /** Ours, outside ACP's codes: a call that got no answer in time, or whose agent is gone (AcpConnection). */
  const val TIMED_OUT = -32098
  const val GONE = -32099

  /** The name the phone tools' MCP server goes by. */
  const val MCP_NAME = "phonecando"

  /** One message from the agent. */
  sealed interface Message

  /** The answer to one of our requests; [error] null means it worked. */
  data class Response(val id: Long, val result: JSONObject, val error: AcpError?) : Message

  /** A request the agent makes of us; [id] is echoed back as it came (number or string). */
  data class Request(val id: Any, val method: String, val params: JSONObject) : Message

  data class Notification(val method: String, val params: JSONObject) : Message

  /** A line read as a message; null for anything that is none (not JSON, not JSON-RPC, an id we never sent). */
  fun parse(line: String): Message? {
    val o = try {
      JSONObject(line)
    } catch (_: Exception) {
      return null
    }
    val method = o.textOf("method")
    val id = if (o.isNull("id")) null else o.opt("id")
    val params = o.optJSONObject("params") ?: JSONObject()
    return when {
      method != null && id != null -> Request(id, method, params)
      method != null -> Notification(method, params)
      id != null -> {
        val ours = (id as? Number)?.toLong() ?: (id as? String)?.toLongOrNull() ?: return null
        val error = o.optJSONObject("error")?.let { AcpError(it.optInt("code", 0), it.textOf("message") ?: "error ${it.optInt("code", 0)}") }
        Response(ours, o.optJSONObject("result") ?: JSONObject(), error)
      }
      else -> null
    }
  }

  fun request(id: Long, method: String, params: JSONObject): String =
    JSONObject().put("jsonrpc", "2.0").put("id", id).put("method", method).put("params", params).toString()

  fun notification(method: String, params: JSONObject): String =
    JSONObject().put("jsonrpc", "2.0").put("method", method).put("params", params).toString()

  fun result(id: Any, result: JSONObject): String =
    JSONObject().put("jsonrpc", "2.0").put("id", id).put("result", result).toString()

  fun error(id: Any, code: Int, message: String): String =
    JSONObject().put("jsonrpc", "2.0").put("id", id).put("error", JSONObject().put("code", code).put("message", message)).toString()

  fun initialize(version: String): JSONObject = JSONObject()
    .put("protocolVersion", PROTOCOL_VERSION)
    .put(
      "clientCapabilities",
      JSONObject()
        .put("fs", JSONObject().put("readTextFile", false).put("writeTextFile", false))
        .put("terminal", false)
        .put("auth", JSONObject().put("terminal", false)),
    )
    .put("clientInfo", JSONObject().put("name", "phonecando").put("title", "PhoneCanDo").put("version", version))

  fun sessionNew(cwd: String, mcpServers: JSONArray, meta: JSONObject?): JSONObject =
    JSONObject().put("cwd", cwd).put("mcpServers", mcpServers).withMeta(meta)

  /** session/load and session/resume take the same. */
  fun sessionOpen(sessionId: String, cwd: String, mcpServers: JSONArray, meta: JSONObject?): JSONObject =
    JSONObject().put("sessionId", sessionId).put("cwd", cwd).put("mcpServers", mcpServers).withMeta(meta)

  fun sessionList(cwd: String): JSONObject = JSONObject().put("cwd", cwd)

  fun setConfigOption(sessionId: String, configId: String, value: String): JSONObject =
    JSONObject().put("sessionId", sessionId).put("configId", configId).put("value", value)

  fun prompt(sessionId: String, text: String): JSONObject = JSONObject()
    .put("sessionId", sessionId)
    .put("prompt", JSONArray().put(JSONObject().put("type", "text").put("text", text)))

  fun cancel(sessionId: String): JSONObject = JSONObject().put("sessionId", sessionId)

  fun permissionSelected(optionId: String): JSONObject =
    JSONObject().put("outcome", JSONObject().put("outcome", "selected").put("optionId", optionId))

  fun permissionCancelled(): JSONObject = JSONObject().put("outcome", JSONObject().put("outcome", "cancelled"))

  /** The phone tools over HTTP for [bridge]; empty for none. */
  fun mcpServers(bridge: AcpBridge?): JSONArray {
    bridge ?: return JSONArray()
    val auth = JSONObject().put("name", "Authorization").put("value", "Bearer ${bridge.token}")
    return JSONArray().put(
      JSONObject()
        .put("type", "http")
        .put("name", MCP_NAME)
        .put("url", "${bridge.url}/mcp")
        .put("headers", JSONArray().put(auth)),
    )
  }

  private fun JSONObject.withMeta(meta: JSONObject?): JSONObject = if (meta == null) this else put("_meta", meta)

  /**
   * Cuts what the agent writes into lines. A line longer than [maxChars]
   * is dropped whole (an agent never needs one that long), so one bad line
   * cannot fill our memory.
   */
  class Lines(private val maxChars: Int = MAX_LINE_CHARS) {
    private val line = StringBuilder()
    private var dropping = false

    fun feed(chars: CharArray, len: Int, out: (String) -> Unit) {
      var start = 0
      for (i in 0 until len) {
        if (chars[i] != '\n') continue
        take(chars, start, i)
        if (!dropping) out(line.toString().removeSuffix("\r"))
        line.setLength(0)
        dropping = false
        start = i + 1
      }
      take(chars, start, len)
    }

    private fun take(chars: CharArray, from: Int, to: Int) {
      if (dropping || from >= to) return
      if (line.length + (to - from) > maxChars) {
        dropping = true
        line.setLength(0)
        return
      }
      line.append(chars, from, to - from)
    }
  }

  const val MAX_LINE_CHARS = 8 * 1024 * 1024
}

/** An error answer: its JSON-RPC code and message. */
internal data class AcpError(val code: Int, val message: String)

/** A request that failed: the agent's error answer, no answer in time, or the agent gone. */
internal class AcpException(val method: String, val error: AcpError) : Exception("$method: ${error.message}")

/** The bridge an ACP agent gets in its session (tools "session"); never printed with its token. */
internal class AcpBridge(val url: String, val token: String) {
  override fun toString() = "AcpBridge($url)"
}

/** [key]'s string; null when it is missing, JSON null or empty (org.json reads a JSON null as "null"). */
internal fun JSONObject.textOf(key: String): String? =
  if (isNull(key)) null else (opt(key) as? String)?.takeIf { it.isNotEmpty() }
