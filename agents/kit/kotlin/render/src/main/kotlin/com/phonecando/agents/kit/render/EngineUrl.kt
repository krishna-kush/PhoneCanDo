package com.phonecando.agents.kit.render

/** Engines listen on loopback only. */
object EngineUrl {
  fun base(port: String) = "http://127.0.0.1:$port"
}
