package com.phonecando.runner.notify

import java.util.Locale

// One running download or import as a notification's line: "Qwen3.5 4B ·
// downloading 45%", or the bytes so far when the total is unknown (an
// import from a provider that did not say). While it waits, why, as the
// app says it (models/logic/modelText.ts, env/logic/steps.ts,
// update/copy.ts): "Qwen3.5 4B · 45%, waiting for a network", "…, trying
// again in a moment", its bar where it stopped; while it re-reads what an
// earlier try left, that, with a bar that only runs (that count starts
// over from nothing). [step] is the job's step as its events say it; every
// job of ours names these the same. Pure.
internal object TransferLines {
  fun of(label: String, importing: Boolean, done: Long, total: Long?, step: String? = null): JobLine {
    val amount = amount(done, total)
    val share = if (total != null && total > 0) (done.toDouble() / total).coerceIn(0.0, 1.0) else null
    return when (step) {
      OFFLINE -> JobLine(label, waiting(amount, "waiting for a network"), share)
      RETRY -> JobLine(label, waiting(amount, "trying again in a moment"), share)
      VERIFY -> JobLine(label, "checking what an earlier try left", null)
      else -> {
        val verb = if (importing) "importing" else "downloading"
        JobLine(label, if (amount == null) verb else "$verb $amount", share)
      }
    }
  }

  private fun waiting(amount: String?, why: String) = if (amount == null) why else "$amount, $why"

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
