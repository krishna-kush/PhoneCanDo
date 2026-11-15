package com.phonecando.runner.engine.acp

import java.io.File

// An ACP engine: the kind's ACP program (engine.acp; an image kind's
// through its image's sh, as a TUI) as a plain process in [cwd] with
// exactly the environment given. Its stdin and stdout stay pipes, ours to
// speak ACP on (AcpConnection); its stderr goes to its agent's log,
// <image>/logs/engine-<agentId>.log (LaunchPlan.logFile), started fresh as
// a server engine's is.
internal object AcpSpawner {
  fun spawn(argv: List<String>, env: Map<String, String>, cwd: File, logFile: File, setup: AcpSetup): AcpProcess {
    val pb = ProcessBuilder(argv)
      .directory(cwd)
      .redirectError(logFile)
    pb.environment().apply {
      clear()
      putAll(env)
    }
    return AcpProcess(pb.start(), logFile, setup)
  }
}
