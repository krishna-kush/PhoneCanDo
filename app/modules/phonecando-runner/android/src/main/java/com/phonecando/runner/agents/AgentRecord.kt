package com.phonecando.runner.agents

/**
 * One agent: a running instance of a kind with its own image, port, password
 * and bridge token. Created and deleted together with its image. The
 * password and token never leave native code except the password, which JS
 * reads to talk to the engine.
 */
data class AgentRecord(
    val id: String,
    /** AgentKind.id, e.g. "opencode". */
    val kind: String,
    val name: String,
    /** The image dir is `<filesDir>/images/<imageId>/` (lre ImageLayout). */
    val imageId: String,
    /** Last port the engine bound; null before its first start. */
    val port: String?,
    val password: String,
    val bridgeToken: String,
    val createdAt: Long,
)

/** Read access to the agents, for the bridge (caller identity) and redaction. */
interface AgentDirectory {
    fun all(): List<AgentRecord>

    fun get(id: String): AgentRecord?

    /** The agent a bridge request comes from; null for an unknown token. */
    fun byBridgeToken(token: String): AgentRecord?
}
