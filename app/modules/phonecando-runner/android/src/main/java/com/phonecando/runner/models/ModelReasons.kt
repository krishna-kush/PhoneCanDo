package com.phonecando.runner.models

import java.util.Locale

// Why an agent's local model cannot serve it, as the detail of a
// model_unavailable (or too_many_models) start failure (after the code and
// ": "): plain words the agent's page shows as they are. Never a path or a
// key. Pure.
internal object ModelReasons {
  fun kindTakesNone(kind: String) = "$kind can't use a local model"

  fun gone(modelId: String) = "its model ($modelId) is no longer on this phone"

  fun loading(name: String) = "its model ($name) is still loading for another agent; try again in a moment"

  /** too_many_models: the user's cap on loaded models. */
  fun capped(cap: Int) =
    (if (cap == 1) "a local model is" else "$cap local models are") +
      " already loaded, the most you set in Settings; stop one first or raise the limit"

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
