package com.phonecando.runner.engine.tui

import com.phonecando.terminal.host.HostedPty

/** A HostedPty that keeps what it is told (PtyHost needs the phone's JNI library). */
class FakePty : HostedPty {
  val written = ArrayList<String>()
  val sizes = ArrayList<Pair<Int, Int>>()
  var closed = false

  override val pid = 4242
  override val isAlive get() = !closed

  override fun write(bytes: ByteArray) {
    written += bytes.toString(Charsets.UTF_8)
  }

  override fun resize(rows: Int, cols: Int) {
    sizes += rows to cols
  }

  override fun signalGroup(signal: Int) {}

  override fun close() {
    closed = true
  }
}
