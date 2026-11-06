package com.phonecando.runner.agents

import android.content.res.AssetManager
import java.io.InputStream

/** The APK's assets as an AssetTree, for ConfigSeeder. */
class AssetManagerTree(private val assets: AssetManager) : AssetTree {
  override fun list(path: String): List<String>? = assets.list(path)?.toList()

  override fun open(path: String): InputStream = assets.open(path)
}
