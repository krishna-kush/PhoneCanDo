package com.phonecando.runner.checks.fanout

// Tells the app an agent's checks or its Check now run changed (the
// phonecandoChecks event, {agentId}; the app reads agentChecks again). The
// native module sets [sink] when it is made (api/ChecksFunctions); with
// none attached nothing is sent, and the app reads agentChecks when it
// comes back.
internal object ChecksEvents {
  const val NAME = "phonecandoChecks"

  @Volatile
  var sink: ((Map<String, Any?>) -> Unit)? = null

  fun changed(agentId: String) {
    val send = sink ?: return
    try {
      send(mapOf("agentId" to agentId))
    } catch (_: Exception) {
      // The module is gone; the next one reads it all again.
    }
  }
}
