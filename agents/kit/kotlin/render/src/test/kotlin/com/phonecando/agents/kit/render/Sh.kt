package com.phonecando.agents.kit.render

import java.io.File

// The host's sh, for running a rendered script in a test: the script on
// stdin (as the guest's `sh -s` gets it), with HOME and the env given.
object Sh {
  /** Exit code and the merged output. */
  fun run(script: String, vararg args: String, home: File? = null): Pair<Int, String> {
    val process = ProcessBuilder(listOf("sh") + args).redirectErrorStream(true).apply {
      if (home != null) environment()["HOME"] = home.path
    }.start()
    process.outputStream.use { it.write(script.toByteArray()) }
    val output = process.inputStream.bufferedReader().readText()
    return process.waitFor() to output
  }
}
