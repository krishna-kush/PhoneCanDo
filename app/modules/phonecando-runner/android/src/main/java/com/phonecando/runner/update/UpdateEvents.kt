package com.phonecando.runner.update

// Tells the app where the update download is (the phonecandoUpdateDownload
// event, the state map). The native module sets [sink] when it is made
// (api/UpdateFunctions); with none attached nothing is sent, and the app
// reads updateDownloadState when it comes back.
internal object UpdateEvents {
  const val NAME = "phonecandoUpdateDownload"

  @Volatile
  var sink: ((Map<String, Any?>) -> Unit)? = null

  fun send(state: UpdateState) {
    val send = sink ?: return
    try {
      send(state.toMap())
    } catch (_: Exception) {
      // The module is gone; the next one reads the state again.
    }
  }
}
