package com.phonecando.runner.notify

import java.util.Locale

// The model server reading a prompt as a notification line: "Qwen3.5 4B ·
// reading the prompt, 33%, 4.1k of 12.3k tokens" once the server says how
// many it reads in all (models/prompt/; whole percent, rounded down, as the
// app's chip), "4.1k tokens so far" when it does not, and no count before
// its first batch then. Pure.
internal object ReadingLines {
  fun of(modelName: String, read: Long, total: Long?): String {
    val base = "$modelName · reading the prompt"
    return when {
      total != null && total > 0 -> {
        val done = read.coerceIn(0, total)
        "$base, ${done * 100 / total}%, ${tokens(done)} of ${tokens(total)} tokens"
      }
      read > 0 -> "$base, ${tokens(read)} tokens so far"
      else -> base
    }
  }

  /** 950 → "950", 4_096 → "4.1k", 12_345 → "12.3k" (the app writes them the same way). */
  fun tokens(count: Long): String =
    if (count < 1_000) count.toString() else String.format(Locale.ROOT, "%.1fk", count / 1_000.0)
}
