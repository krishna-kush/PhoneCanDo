package com.phonecando.runner.schedule

import android.content.Context
import android.content.SharedPreferences
import com.phonecando.runner.PhoneCanDoServeService

// The agent page's "Can schedule itself" switch: on by default, so an agent
// may set its own schedules with schedule_add; off, the tool answers
// not_allowed (its schedules already set stay, for the user to keep or
// remove). Kept in the runner's prefs (PhoneCanDoServeService.PREFS) as the
// set of agent ids switched off; a deleted agent leaves it (forget). One
// store per process (get).
class SelfScheduling(private val prefs: SharedPreferences) {
  @Volatile private var cached: Set<String>? = null

  private fun off(): Set<String> = cached ?: synchronized(this) {
    cached ?: try {
      prefs.getStringSet(K_OFF, null)?.toSet().orEmpty()
    } catch (_: ClassCastException) {
      emptySet()
    }.also { cached = it }
  }

  fun isOn(agentId: String): Boolean = agentId !in off()

  fun set(agentId: String, on: Boolean) = synchronized(this) {
    val now = if (on) off() - agentId else off() + agentId
    prefs.edit().putStringSet(K_OFF, now).apply()
    cached = now
  }

  fun forget(agentId: String) {
    if (!isOn(agentId)) set(agentId, true)
  }

  companion object {
    const val K_OFF = "schedule_self_off"

    @Volatile private var store: SelfScheduling? = null

    fun get(context: Context): SelfScheduling = store ?: synchronized(this) {
      store ?: SelfScheduling(
        (context.applicationContext ?: context).getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE),
      ).also { store = it }
    }
  }
}
