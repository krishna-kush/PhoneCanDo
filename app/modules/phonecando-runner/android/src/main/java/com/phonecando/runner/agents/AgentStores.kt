package com.phonecando.runner.agents

import android.content.Context
import java.io.File

// The one AgentStore of this process, over files/state/agents.json. The
// module, the engine supervisor, the bridge and crash redaction all read the
// same instance, so a change is seen everywhere at once.
object AgentStores {
  @Volatile private var store: AgentStore? = null

  fun get(context: Context): AgentStore = store ?: synchronized(this) {
    store ?: AgentStore(file(context)).also { store = it }
  }

  private fun file(context: Context): File {
    val app = context.applicationContext ?: context
    return File(File(app.filesDir, "state"), "agents.json")
  }
}
