package com.phonecando.runner.limits

import android.content.Context
import android.content.SharedPreferences
import com.phonecando.runner.PhoneCanDoServeService

// The user's run limits (RunLimits), kept in the runner's prefs
// (PhoneCanDoServeService.PREFS) so the engine supervisor and the model
// server hold to them with no JS around: one int per cap, absent for none.
// Read once, then cached; a write replaces both caps and returns them as
// kept. One store per process (get).
class RunLimitStore(private val prefs: SharedPreferences) {
  @Volatile private var cached: RunLimits? = null

  fun read(): RunLimits = cached ?: synchronized(this) {
    cached ?: RunLimits(int(K_MAX_AGENTS), int(K_MAX_MODELS)).also { cached = it }
  }

  /** Keeps [limits] (already validated: RunLimits.cap) and returns them. */
  fun write(limits: RunLimits): RunLimits = synchronized(this) {
    val kept = RunLimits(RunLimits.stored(limits.maxAgents), RunLimits.stored(limits.maxModels))
    val edit = prefs.edit()
    put(edit, K_MAX_AGENTS, kept.maxAgents)
    put(edit, K_MAX_MODELS, kept.maxModels)
    edit.apply()
    cached = kept
    kept
  }

  private fun int(key: String): Int? = try {
    if (prefs.contains(key)) RunLimits.stored(prefs.getInt(key, 0)) else null
  } catch (_: ClassCastException) {
    null
  }

  private fun put(edit: SharedPreferences.Editor, key: String, value: Int?) {
    if (value == null) edit.remove(key) else edit.putInt(key, value)
  }

  companion object {
    const val K_MAX_AGENTS = "run_max_agents"
    const val K_MAX_MODELS = "run_max_models"

    @Volatile private var store: RunLimitStore? = null

    fun get(context: Context): RunLimitStore = store ?: synchronized(this) {
      store ?: RunLimitStore(
        (context.applicationContext ?: context).getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE),
      ).also { store = it }
    }
  }
}
