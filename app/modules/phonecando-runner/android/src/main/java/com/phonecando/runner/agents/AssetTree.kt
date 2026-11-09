package com.phonecando.runner.agents

import java.io.InputStream

/** Read-only view of the APK assets (AssetManager on the phone, a folder in tests). */
interface AssetTree {
  /** Children of a folder; empty for a file or an empty folder; null when unreadable. */
  fun list(path: String): List<String>?

  fun open(path: String): InputStream
}
