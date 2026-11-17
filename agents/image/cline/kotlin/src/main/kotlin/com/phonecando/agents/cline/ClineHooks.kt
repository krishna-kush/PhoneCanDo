package com.phonecando.agents.cline

import com.phonecando.agents.kit.KindHooks
import java.io.File

// Cline's code: the model its TUI last used, for its ACP chats
// (ChosenModel). Everything else about it is data in ../agent.json.
object ClineHooks : KindHooks {
  const val MODEL = "cline.model"

  override val id = "cline"

  override fun acpOptions(name: String): ((File) -> Map<String, String>)? = if (name == MODEL) ChosenModel::options else null
}
