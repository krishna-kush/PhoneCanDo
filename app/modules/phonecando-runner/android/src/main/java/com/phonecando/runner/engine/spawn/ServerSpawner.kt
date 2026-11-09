package com.phonecando.runner.engine.spawn

import java.io.File

// A server engine: a plain process from the native-library dir, in HOME,
// with exactly the environment given and its stdout and stderr in
// <image>/logs/engine.log.
internal object ServerSpawner {
  fun spawn(argv: List<String>, env: Map<String, String>, home: File, logFile: File): ServerProcess {
    val pb = ProcessBuilder(argv)
      .directory(home)
      .redirectErrorStream(true)
      .redirectOutput(logFile)
    pb.environment().apply {
      clear()
      putAll(env)
    }
    return ServerProcess(pb.start(), logFile)
  }
}
