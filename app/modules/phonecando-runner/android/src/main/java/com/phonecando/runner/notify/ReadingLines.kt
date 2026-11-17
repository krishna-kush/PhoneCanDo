package com.phonecando.runner.notify

import java.util.Locale

// The model server reading a prompt as its notification's line: "Qwen3.5
// 4B · reading the prompt, 33%, 4.1k of 12.3k tokens" once the server says
// how many it reads in all (models/prompt/; whole percent, rounded down, as
// the app's chip), "4.1k tokens so far" when it does not, and no count
// before its first batch then. A tap lands on the Home of the agent it
// reads for, when it is one. Pure.
internal object ReadingLines {
  fun of(modelName: String, read: Long, total: Long?): JobLine {
    val base = "reading the prompt"
    return when {
      total != null && total > 0 -> {
        val done = read.coerceIn(0, total)
        JobLine(modelName, "$base, ${done * 100 / total}%, ${tokens(done)} of ${tokens(total)} tokens", done.toDouble() / total)
      }
      read > 0 -> JobLine(modelName, "$base, ${tokens(read)} tokens so far", null)
      else -> JobLine(modelName, base, null)
    }
  }

  /** Its own notification: [agentIds], the agents the server reads for. */
  fun item(modelId: String, modelName: String, read: Long, total: Long?, agentIds: List<String>): ServiceItem =
    of(modelName, read, total).item("reading:$modelId", agentIds.singleOrNull()?.let { LaunchTarget(LaunchTarget.HOME, it) }, PUBLIC)

  /** 950 → "950", 4_096 → "4.1k", 12_345 → "12.3k" (the app writes them the same way). */
  fun tokens(count: Long): String =
    if (count < 1_000) count.toString() else String.format(Locale.ROOT, "%.1fk", count / 1_000.0)

  // No model name, so the lock screen may show it.
  private const val PUBLIC = "Reading the prompt"
}
