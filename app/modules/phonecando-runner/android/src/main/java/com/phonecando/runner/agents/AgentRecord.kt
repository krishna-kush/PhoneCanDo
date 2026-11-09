package com.phonecando.runner.agents

/**
 * One agent: a running instance of a kind with its own image, port, password
 * and bridge token. Created and deleted together with its image. The token
 * never leaves native code; the password reaches JS only inside the TUI
 * client's recipe (clientRecipe), which JS hands straight to the PTY.
 */
data class AgentRecord(
    val id: String,
    /** The kind's id (KindCatalog), e.g. "opencode". */
    val kind: String,
    val name: String,
    /** The image dir is `<filesDir>/images/<imageId>/` (lre ImageLayout). */
    val imageId: String,
    /** Last port the engine bound; null before its first start. */
    val port: String?,
    val password: String,
    val bridgeToken: String,
    val createdAt: Long,
    /** Its engine was ready at least once: a relaunch adds the kind's resume args. */
    val ranBefore: Boolean = false,
    /** The version its kind's install put in its image (recordInstall); null before that. */
    val installedVersion: String? = null,
)

/** Read access to the agents, for the bridge (caller identity) and redaction. */
interface AgentDirectory {
    fun all(): List<AgentRecord>

    fun get(id: String): AgentRecord?

    /** The agent a bridge request comes from; null for an unknown token. */
    fun byBridgeToken(token: String): AgentRecord?
}
