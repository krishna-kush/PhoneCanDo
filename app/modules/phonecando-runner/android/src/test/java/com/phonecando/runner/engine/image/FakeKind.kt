package com.phonecando.runner.engine.image

import com.phonecando.agents.kit.AgentConfig
import com.phonecando.agents.kit.AgentKind
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.HttpProbe
import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.LaunchSpec
import java.io.File

// A kind that keeps its instructions file in .<id>/ under HOME, or in the
// agent's own state folder ([instructions] null: it has none), its config
// in [configFolder] there (null: none), and a user's state at [userState]
// under HOME. It never launches.
class FakeKind(
  override val id: String,
  override val displayName: String,
  private val instructions: String?,
  private val configFolder: String? = null,
  private val userState: List<String> = emptyList(),
) : AgentKind {
  override val config: AgentConfig? = null
  override val ownStateSupported: Boolean = true

  override fun instructionsFile(home: File, stateDir: File?): File? =
    instructions?.let { File(stateDir ?: File(home, ".$id"), it) }

  override fun configDir(home: File, stateDir: File?): File? = configFolder?.let { File(stateDir ?: File(home, ".$id"), it) }

  override fun userStatePaths(home: File): List<File> = userState.map { File(home, it) }

  override fun launch(ctx: LaunchContext): LaunchSpec = throw UnsupportedOperationException()

  override fun healthProbe(port: String, password: String): HttpProbe = throw UnsupportedOperationException()

  override fun eventStream(port: String, password: String): HttpProbe? = null

  override fun parseEvent(frame: String): EngineEvent? = null

  override fun passwordForms(password: String): List<String> = emptyList()
}
