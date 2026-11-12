package com.phonecando.runner.engine.work

import android.content.Context
import android.content.SharedPreferences
import com.phonecando.runner.PhoneCanDoServeService

// The agents the user keeps running though idle (the agent page's "Keep
// running" switch): the runner's idle stop (ReclaimPolicy) leaves them, and
// the memory guard stops them after the agents with nothing to do. Kept in
// the runner's prefs (PhoneCanDoServeService.PREFS) as a set of agent ids;
// a deleted agent leaves it (forget). One store per process (get).
class KeepRunning(private val prefs: SharedPreferences) {
  @Volatile private var cached: Set<String>? = null

  fun all(): Set<String> = cached ?: synchronized(this) {
    cached ?: try {
      prefs.getStringSet(K_KEEP_RUNNING, null)?.toSet().orEmpty()
    } catch (_: ClassCastException) {
      emptySet()
    }.also { cached = it }
  }

  fun isOn(agentId: String): Boolean = agentId in all()

  fun set(agentId: String, on: Boolean) = synchronized(this) {
    val now = if (on) all() + agentId else all() - agentId
    prefs.edit().putStringSet(K_KEEP_RUNNING, now).apply()
    cached = now
  }

  fun forget(agentId: String) {
    if (isOn(agentId)) set(agentId, false)
  }

  companion object {
    const val K_KEEP_RUNNING = "keep_running"

    @Volatile private var store: KeepRunning? = null

    fun get(context: Context): KeepRunning = store ?: synchronized(this) {
      store ?: KeepRunning(
        (context.applicationContext ?: context).getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE),
      ).also { store = it }
    }
  }
}
