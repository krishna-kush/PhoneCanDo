package com.phonecando.runner.agents

import android.content.Context
import android.util.Log

// The one RuntimeCatalog of this process, read from the APK assets on first
// use, before the kinds (KindCatalogs), which are bound to it.
object RuntimeCatalogs {
  @Volatile private var catalog: RuntimeCatalog? = null

  fun get(context: Context): RuntimeCatalog = catalog ?: synchronized(this) {
    catalog ?: load(context).also { catalog = it }
  }

  private fun load(context: Context): RuntimeCatalog {
    val app = context.applicationContext ?: context
    return RuntimeCatalog.load(AssetManagerTree(app.assets)) { folder, e ->
      Log.w("PhoneCanDoRuntimes", "runtime $folder left out: ${e.message}")
    }
  }
}
