package com.phonecando.runner.agents

/**
 * One agent: a running instance of a kind with its own port, password and
 * bridge token, on a machine (an image) it may share with other agents, as
 * apps share a PC. JS deletes the machine with its last agent. The token
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
    /**
     * The version its kind's install put in its image (recordInstall); null
     * before that. One install serves every agent of the kind on a machine.
     */
    val installedVersion: String? = null,
    /**
     * The local model it runs on (a model id in files/models/); null: the
     * agent's own setup. Only a kind with a `models` block gets one.
     */
    val model: String? = null,
    /**
     * It keeps its sign-in, settings, chats and global instructions in its
     * own folder on the machine (engine/image/AgentFiles), not where its
     * kind keeps them: it was made while another agent of its kind was there.
     */
    val ownState: Boolean = false,
)

/** Read access to the agents, for the bridge (caller identity) and redaction. */
interface AgentDirectory {
    fun all(): List<AgentRecord>

    fun get(id: String): AgentRecord?

    /** The agent a bridge request comes from; null for an unknown token. */
    fun byBridgeToken(token: String): AgentRecord?

    /** The agents on the machine [imageId], oldest first. */
    fun onMachine(imageId: String): List<AgentRecord> = all().filter { it.imageId == imageId }
}
