package com.phonecando.runner.notify

import java.util.Locale

// The model server reading a prompt as a notification line: "Qwen3.5 4B ·
// reading the prompt, 4.1k tokens so far", without the count before its
// first batch is read. There is no total to show (models/prompt/). Pure.
internal object ReadingLines {
  fun of(modelName: String, read: Long): String =
    if (read <= 0) "$modelName · reading the prompt" else "$modelName · reading the prompt, ${tokens(read)} tokens so far"

  /** 950 → "950", 4_096 → "4.1k", 12_345 → "12.3k" (the app writes them the same way). */
  fun tokens(count: Long): String =
    if (count < 1_000) count.toString() else String.format(Locale.ROOT, "%.1fk", count / 1_000.0)
}
