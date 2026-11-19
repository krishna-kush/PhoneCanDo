package com.phonecando.runner.prompts

import android.content.Context
import android.content.SharedPreferences
import com.phonecando.runner.PhoneCanDoServeService

// An agent's "Allow everything": off by default; on, its permission
// questions in ACP mode (every kind of step: commands, edits, going
// online…) are answered allow at once and never reach you (AcpAgent, as
// our own tools' are). Turned on from the question's own "Allow
// everything" key, off again on its agent page. Kept in the runner's prefs
// (PhoneCanDoServeService.PREFS) as the set of agent ids switched on; a
// deleted agent leaves it (forget). One store per process (get).
class AllowAll(private val prefs: SharedPreferences) {
  @Volatile private var cached: Set<String>? = null

  private fun on(): Set<String> = cached ?: synchronized(this) {
    cached ?: try {
      prefs.getStringSet(K_ON, null)?.toSet().orEmpty()
    } catch (_: ClassCastException) {
      emptySet()
    }.also { cached = it }
  }

  fun isOn(agentId: String): Boolean = agentId in on()

  fun set(agentId: String, on: Boolean) = synchronized(this) {
    val now = if (on) on() + agentId else on() - agentId
    prefs.edit().putStringSet(K_ON, now).apply()
    cached = now
  }

  fun forget(agentId: String) {
    if (isOn(agentId)) set(agentId, false)
  }

  companion object {
    const val K_ON = "permission_allow_all"

    @Volatile private var store: AllowAll? = null

    fun get(context: Context): AllowAll = store ?: synchronized(this) {
      store ?: AllowAll(
        (context.applicationContext ?: context).getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE),
      ).also { store = it }
    }
  }
}
