package com.phonecando.runner.models

import java.util.Locale

// Why an agent's local model cannot serve it, as the detail of a
// model_unavailable start failure (after "model_unavailable: "): plain words
// the agent's page shows as they are. Never a path or a key. Pure.
internal object ModelReasons {
  fun kindTakesNone(kind: String) = "$kind can't use a local model"

  fun gone(modelId: String) = "its model ($modelId) is no longer on this phone"

  fun busy(loadedName: String) = "another model ($loadedName) is loaded for a running agent; stop that agent first"

  fun tooBig(name: String, needBytes: Long, budgetBytes: Long) =
    "$name needs ${gb(needBytes)} of RAM, more than this phone can spare (${gb(budgetBytes)})"

  fun unsupported(reason: String) = "this phone can't run local models: $reason"

  fun notReady(reason: String) = "the model server did not start: $reason"

  /** [code] null: it was found gone. */
  fun exited(name: String, code: Int?) =
    "its model server ($name) stopped" + (code?.let { " with exit code $it" } ?: "")

  fun noServer() = "this build has no model server"

  fun gb(bytes: Long): String = String.format(Locale.ROOT, "%.1f GB", bytes / 1e9)
}
