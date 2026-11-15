package com.phonecando.runner.engine.acp

import org.json.JSONObject

/** Requests to an ACP agent that wait for the answer (AcpConnection); each throws AcpException. */
internal fun interface AcpRpc {
  fun request(method: String, params: JSONObject, timeoutMs: Long): JSONObject
}

// The chat an ACP driver works in. A start that wants a chat of its own
// (a scheduled task's newChat) gets a new one (session/new). Any other
// goes back to the one we kept (AgentRecord.acpChat: where ACP mode last
// worked with no terminal launch since, or what a Check now gave back),
// else the newest the agent lists for the folder when it can list them,
// reopened with its history (session/load) or without it
// (session/resume), as the agent can; a new chat when none of that works. Each request carries the
// folder, the bridge as an MCP server over HTTP when the setup hands it
// in the chat and the agent takes HTTP (else no servers: no phone tools
// this time, as its env has no bridge either), and the kind's `_meta`.
// On a chat it opened, the kind's config options are set where the
// agent offers them; one it refuses is skipped. For a start with a chat
// of its own, before() names the chat it would have gone back to, so a
// Check now can give it back. Pure over [rpc].
internal class AcpChats(
  private val rpc: AcpRpc,
  private val caps: AcpCaps,
  private val setup: AcpSetup,
  private val log: (String) -> Unit = {},
) {
  /** A chat it opened: its id, and the agent's answer (its config options). */
  class Opened(val chatId: String, val answer: JSONObject)

  fun open(newChat: Boolean, stored: String?): Opened {
    if (!newChat) {
      stored?.let { id -> reopen(id)?.let { return it } }
      newestListed()?.takeIf { it != stored }?.let { id -> reopen(id)?.let { return it } }
    }
    return createNew()
  }

  /**
   * The chat the agent's next own-app start would open, had this start not
   * taken a chat of its own: the one we kept (a terminal launch opens it),
   * else the newest it lists (what its resume args go back to); null when
   * neither.
   */
  fun before(stored: String?): String? = stored ?: newestListed()

  fun createNew(): Opened {
    val answer = rpc.request(AcpWire.SESSION_NEW, AcpWire.sessionNew(setup.cwd, mcp(), meta()), OPEN_MS)
    val id = AcpAnswers.sessionId(answer)
      ?: throw AcpException(AcpWire.SESSION_NEW, AcpError(0, "its answer named no chat"))
    return Opened(id, answer)
  }

  fun applyOptions(opened: Opened) {
    for ((id, value) in AcpAnswers.optionsToSet(opened.answer, setup.options)) {
      try {
        rpc.request(AcpWire.SET_CONFIG_OPTION, AcpWire.setConfigOption(opened.chatId, id, value), OPTION_MS)
      } catch (e: AcpException) {
        log("option $id not set: ${e.error.message}")
      }
    }
  }

  private fun reopen(id: String): Opened? {
    val method = when {
      caps.loadSession -> AcpWire.SESSION_LOAD
      caps.resume -> AcpWire.SESSION_RESUME
      else -> return null
    }
    return try {
      Opened(id, rpc.request(method, AcpWire.sessionOpen(id, setup.cwd, mcp(), meta()), OPEN_MS))
    } catch (e: AcpException) {
      log("$method failed: ${e.error.message}")
      null
    }
  }

  private fun newestListed(): String? {
    if (!caps.list) return null
    return try {
      AcpAnswers.newestChat(rpc.request(AcpWire.SESSION_LIST, AcpWire.sessionList(setup.cwd), LIST_MS))
    } catch (e: AcpException) {
      log("${AcpWire.SESSION_LIST} failed: ${e.error.message}")
      null
    }
  }

  private fun mcp() = AcpWire.mcpServers(setup.bridge?.takeIf { caps.mcpHttp })

  private fun meta(): JSONObject? = setup.meta?.let {
    try {
      JSONObject(it)
    } catch (_: Exception) {
      log("its _meta is no JSON object; left out")
      null
    }
  }

  companion object {
    const val OPEN_MS = 90_000L
    const val LIST_MS = 30_000L
    const val OPTION_MS = 30_000L
  }
}
