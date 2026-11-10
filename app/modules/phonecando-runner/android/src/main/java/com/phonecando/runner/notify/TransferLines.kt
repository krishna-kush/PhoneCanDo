package com.phonecando.runner.notify

import java.util.Locale

// One running model job as a notification line: "Qwen3.5 4B · downloading
// 45%", or the bytes so far when the total is unknown (an import from a
// provider that did not say). Pure.
internal object TransferLines {
  fun of(label: String, importing: Boolean, done: Long, total: Long?): String {
    val verb = if (importing) "importing" else "downloading"
    val amount = if (total != null && total > 0) {
      "${(done * 100 / total).coerceIn(0, 100)}%"
    } else {
      String.format(Locale.ROOT, "%.1f GB", done / 1e9)
    }
    return "$label · $verb $amount"
  }
}
