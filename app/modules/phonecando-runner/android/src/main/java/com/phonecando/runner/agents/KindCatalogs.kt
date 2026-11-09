package com.phonecando.runner.agents

import android.content.Context
import android.util.Log
import com.phonecando.agents.builtin.BuiltinHooks
import java.io.File

// The one KindCatalog of this process, read from the APK assets and the
// user's kinds (USER_DIR under files/) on first use, each kind bound to
// the runtimes it needs (RuntimeCatalogs): the module, the engine
// supervisor and crash redaction all reach the kinds through it, whichever
// of them comes first. A user kind added later loads with the next process.
object KindCatalogs {
  @Volatile private var catalog: KindCatalog? = null

  fun get(context: Context): KindCatalog = catalog ?: synchronized(this) {
    catalog ?: load(context).also { catalog = it }
  }

  /** Where the user's kinds are, under the app's files dir. */
  const val USER_DIR = "state/agent-kinds/user"

  private fun load(context: Context): KindCatalog {
    val app = context.applicationContext ?: context
    val user = File(app.filesDir, USER_DIR)
    val runtimes = RuntimeCatalogs.get(app)
    return KindCatalog.load(AssetManagerTree(app.assets), user, BuiltinHooks.all, runtimes, BuiltinHooks.defaultKindId) { folder, e ->
      Log.w("PhoneCanDoKinds", "agent kind $folder left out: ${e.message}")
    }
  }
}
