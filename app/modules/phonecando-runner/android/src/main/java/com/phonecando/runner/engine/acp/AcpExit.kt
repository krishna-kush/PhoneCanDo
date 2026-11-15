package com.phonecando.runner.engine.acp

/**
 * Why an ACP engine died, for its status: its exit code and the last line
 * it wrote to stderr (already redacted), cut to MAX_CHARS. It has no
 * screen, so that line is all it can tell you. Pure.
 */
internal object AcpExit {
  const val MAX_CHARS = 200

  fun reason(code: Int, stderrTail: String?): String {
    val last = stderrTail?.lineSequence()?.map { it.trim() }?.lastOrNull { it.isNotEmpty() }
    val base = "exited with code $code"
    return if (last == null) base else "$base: ${last.take(MAX_CHARS)}"
  }
}
