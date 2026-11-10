package com.phonecando.runner.models

import java.util.concurrent.CopyOnWriteArrayList

// The API keys this process gave its model servers (a fresh one per server
// start), for redaction: an engine's log or a crash can carry one, and an
// agent's env holds it. The last few stay listed after their server stopped.
internal object ModelServerKeys {
  private const val MAX = 16
  private val keys = CopyOnWriteArrayList<String>()

  fun add(key: String) {
    keys.addIfAbsent(key)
    while (keys.size > MAX) keys.removeAt(0)
  }

  fun issued(): List<String> = keys.toList()
}
