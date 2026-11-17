package com.phonecando.runner.notify

import java.util.Locale

// One running download or import as a notification line: "Qwen3.5 4B ·
// downloading 45%", or the bytes so far when the total is unknown (an
// import from a provider that did not say). While it waits, why, as the
// app says it (models/logic/modelText.ts, env/logic/steps.ts,
// update/copy.ts): "Qwen3.5 4B · 45%, waiting for a network", "…, trying
// again in a moment"; while it re-reads what an earlier try left, that,
// with no share (that count starts over from nothing). [step] is the job's
// step as its events say it; every job of ours names these the same. Pure.
internal object TransferLines {
  fun of(label: String, importing: Boolean, done: Long, total: Long?, step: String? = null): String {
    val amount = amount(done, total)
    return when (step) {
      OFFLINE -> waiting(label, amount, "waiting for a network")
      RETRY -> waiting(label, amount, "trying again in a moment")
      VERIFY -> "$label · checking what an earlier try left"
      else -> {
        val verb = if (importing) "importing" else "downloading"
        if (amount == null) "$label · $verb" else "$label · $verb $amount"
      }
    }
  }

  private fun waiting(label: String, amount: String?, why: String) =
    if (amount == null) "$label · $why" else "$label · $amount, $why"

  // "45%", "1.2 GB" when the total is unknown, null before any byte.
  private fun amount(done: Long, total: Long?): String? = when {
    total != null && total > 0 -> "${(done * 100 / total).coerceIn(0, 100)}%"
    done > 0 -> String.format(Locale.ROOT, "%.1f GB", done / 1e9)
    else -> null
  }

  private const val OFFLINE = "offline"
  private const val RETRY = "retry"
  private const val VERIFY = "verify"
}
