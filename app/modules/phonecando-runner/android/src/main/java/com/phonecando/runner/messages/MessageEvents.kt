package com.phonecando.runner.messages

// Tells the app the messages changed (the phonecandoMessages event,
// {unread}: agent id to unread count). The native module sets [sink] when
// it is made (api/MessageFunctions); with none attached nothing is sent,
// and the app reads messageLog and unreadCounts when it comes back.
object MessageEvents {
  const val NAME = "phonecandoMessages"

  @Volatile
  var sink: ((Map<String, Any?>) -> Unit)? = null

  fun changed(unread: Map<String, Int>) {
    val send = sink ?: return
    try {
      send(mapOf("unread" to unread.mapValues { it.value.toDouble() }))
    } catch (_: Exception) {
      // The module is gone; the next one reads it all again.
    }
  }
}
