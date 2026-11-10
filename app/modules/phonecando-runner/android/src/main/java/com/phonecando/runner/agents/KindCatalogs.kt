package com.phonecando.runner.agents

import android.content.Context
import android.util.Log
import com.phonecando.agents.builtin.BuiltinHooks
import com.phonecando.agents.kit.manifest.Origin
import com.phonecando.runner.agents.user.UserKinds
import java.io.File

// The one KindCatalog of this process, read from the APK assets and the
// user's kinds (USER_DIR under files/) on first use, each kind bound to
// the runtimes it needs (RuntimeCatalogs): the module, the engine
// supervisor and crash redaction all reach the kinds through it, whichever
// of them comes first. A save or delete of a user kind (userKinds) reloads
// it in place: every later lookup sees the new catalog, while an engine
// that runs keeps the kind it started with (its LaunchPlan), so a reload
// never touches it.
object KindCatalogs {
  @Volatile private var catalog: KindCatalog? = null

  fun get(context: Context): KindCatalog = catalog ?: synchronized(this) {
    catalog ?: load(context).also { catalog = it }
  }

  /** Reads every kind again, the user's folder as it is now. */
  fun reload(context: Context): KindCatalog = synchronized(this) {
    load(context).also { catalog = it }
  }

  /** The user's kinds on disk, checked against this build's bundled kinds and runtimes. */
  fun userKinds(context: Context): UserKinds {
    val app = context.applicationContext ?: context
    val bundled = get(app).all().filter { it.manifest.origin == Origin.BUNDLED }.map { it.id }.toSet()
    return UserKinds(File(app.filesDir, USER_DIR), bundled, RuntimeCatalogs.get(app).byId)
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
