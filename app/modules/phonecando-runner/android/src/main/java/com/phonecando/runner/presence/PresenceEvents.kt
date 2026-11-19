package com.phonecando.runner.presence

// Tells the app the presence changed (the phonecandoPresence event, the
// frame as PresenceJs maps it). The native module sets [sink] when it is
// made; with none attached nothing is sent, and the app reads
// presenceSnapshot when it comes back.
object PresenceEvents {
  const val NAME = "phonecandoPresence"

  @Volatile
  var sink: ((Map<String, Any?>) -> Unit)? = null

  fun send(frame: PresenceFrame) {
    val send = sink ?: return
    try {
      send(PresenceJs.of(frame))
    } catch (_: Exception) {
      // The module is gone; the next one reads it again.
    }
  }
}
