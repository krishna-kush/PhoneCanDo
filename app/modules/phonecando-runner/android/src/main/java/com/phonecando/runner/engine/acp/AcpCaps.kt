package com.phonecando.runner.engine.acp

import org.json.JSONObject

/**
 * What an ACP agent said it can do in its initialize answer: reopen a chat
 * with its history (loadSession) or without it (resume), list its chats,
 * take an MCP server over HTTP, read images; how it signs you in; who it is.
 * Pure.
 */
internal data class AcpCaps(
  val loadSession: Boolean = false,
  val resume: Boolean = false,
  val list: Boolean = false,
  val mcpHttp: Boolean = false,
  val image: Boolean = false,
  val authMethods: List<AuthMethod> = emptyList(),
  val agentName: String? = null,
  val agentVersion: String? = null,
) {
  /** One way to sign in: [type] "agent" (the agent does it) or "terminal" (in a terminal it runs). */
  data class AuthMethod(val id: String, val type: String)

  companion object {
    fun of(result: JSONObject): AcpCaps {
      val agent = result.optJSONObject("agentCapabilities") ?: JSONObject()
      val session = agent.optJSONObject("sessionCapabilities") ?: JSONObject()
      val info = result.optJSONObject("agentInfo")
      val methods = result.optJSONArray("authMethods")
      return AcpCaps(
        loadSession = agent.optBoolean("loadSession", false),
        resume = offered(session, "resume"),
        list = offered(session, "list"),
        mcpHttp = agent.optJSONObject("mcpCapabilities")?.optBoolean("http", false) == true,
        image = agent.optJSONObject("promptCapabilities")?.optBoolean("image", false) == true,
        authMethods = (0 until (methods?.length() ?: 0)).mapNotNull { i ->
          val m = methods?.optJSONObject(i) ?: return@mapNotNull null
          val id = m.textOf("id") ?: return@mapNotNull null
          AuthMethod(id, if (m.textOf("type") == "terminal") "terminal" else "agent")
        },
        agentName = info?.textOf("name"),
        agentVersion = info?.textOf("version"),
      )
    }

    // A session capability is offered by an object (its options, often
    // empty); a plain true counts too, false or null does not.
    private fun offered(session: JSONObject, key: String): Boolean {
      if (session.isNull(key)) return false
      return when (val value = session.opt(key)) {
        is Boolean -> value
        else -> value != null
      }
    }
  }
}
