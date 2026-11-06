package com.phonecando.runner

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

// The telemetry store: SharedPreferences "phonecando_telemetry", its keys and
// the one lock. Every read-modify-write (TelemetryRecorder's counters and
// engine exit, TelemetryCrashCapture's crash list, TelemetrySwitch's on/off
// choice), every read and every consume holds that lock, so a consume can
// never lose a concurrent increment or drain a crash twice. Writes use
// apply(), except a crash, which uses commit() because the process is about
// to die, and a consume (see drain). A corrupt store is cleared, never
// thrown. The same file holds the user's on/off choice, which no reset
// clears, and the last stderr tail, which a consume keeps.
internal object TelemetryStore {
  private const val TAG = "PhoneCanDoTelemetry"
  const val PREFS = "phonecando_telemetry"

  const val K_LOW_MEMORY = "low_memory_trims"
  const val K_STARTS = "engine_starts"
  const val K_START_FAILS = "engine_start_fails"
  const val K_DIED = "engine_died"
  const val K_PORT_SQUATS = "engine_port_squats"
  const val K_EXIT_CODE = "engine_last_exit_code"
  const val K_DIED_AT = "engine_last_died_at"
  const val K_STDERR_TAIL = "engine_last_stderr_tail"
  const val K_BOOT_MS = "engine_last_boot_ms"
  const val K_TOOL_CALLS = "tool_calls"
  const val K_SESSION_CREATES = "session_creates"
  private const val K_CRASHES = "native_crashes"
  // A setting, not a counter: kept by every reset.
  const val K_ENABLED = "telemetry_enabled"

  private const val MAX_CRASHES = 10

  val lock = Any()

  @Volatile private var app: Context? = null
  @Volatile private var opened: SharedPreferences? = null

  // The context the file is opened with; TelemetryRecorder.install sets it.
  fun attach(context: Context) {
    app = context
  }

  // The file; null before attach or while it cannot be opened.
  fun prefs(): SharedPreferences? {
    opened?.let { return it }
    val context = app ?: return null
    // Credential-encrypted storage is unavailable before the first unlock;
    // a later call retries.
    return try {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).also { opened = it }
    } catch (_: Throwable) {
      null
    }
  }

  // The stored half of a snapshot. Internal for the JVM tests (src/test).
  class Stored(
    val lowMemoryTrims: Int = 0,
    val starts: Int = 0,
    val startFails: Int = 0,
    val died: Int = 0,
    val portSquats: Int = 0,
    val lastExitCode: Int? = null,
    val lastDiedAt: Long? = null,
    val lastStderrTail: String? = null,
    val lastBootMs: Long? = null,
    val toolCalls: Map<String, Int> = emptyMap(),
    val sessionCreates: Int = 0,
    val crashes: List<Map<String, Any?>> = emptyList(),
  )

  // ---- writing ---------------------------------------------------------

  fun bump(key: String) = mutate { p, e -> e.putInt(key, inc(p.getInt(key, 0))) }

  fun mutate(block: (SharedPreferences, SharedPreferences.Editor) -> Unit) = mutateIn(prefs(), block)

  // One read-modify-write of `store` under the lock, applied. The JVM tests
  // pass their own store (TelemetryRecorder.engineDiedIn).
  fun mutateIn(store: SharedPreferences?, block: (SharedPreferences, SharedPreferences.Editor) -> Unit) {
    val p = store ?: return
    synchronized(lock) {
      try {
        val e = p.edit()
        block(p, e)
        e.apply()
      } catch (e: Exception) {
        // Wrongly typed key or malformed JSON: a corrupt store.
        Log.w(TAG, "telemetry store unreadable, resetting", e)
        reset(p)
      } catch (_: Throwable) {
        // An Error (e.g. out of memory) is not corruption: keep the store.
      }
    }
  }

  // Adds one crash record (TelemetryCrashCapture), keeping the newest
  // MAX_CRASHES. Synchronous commit(): the platform kills the process right
  // after.
  fun appendCrash(p: SharedPreferences, crash: JSONObject) {
    synchronized(lock) {
      val list = try {
        JSONArray(p.getString(K_CRASHES, null) ?: "[]")
      } catch (_: Throwable) {
        JSONArray()
      }
      // Drop entries a reader would reject, so one bad entry cannot make
      // every later read reset the store.
      val valid = ArrayList<JSONObject>(list.length() + 1)
      for (i in 0 until list.length()) {
        val c = list.optJSONObject(i) ?: continue
        if (runCatching { crashMap(c) }.isSuccess) valid += c
      }
      valid += crash
      val kept = JSONArray()
      for (c in valid.takeLast(MAX_CRASHES)) kept.put(c)
      try {
        p.edit().putString(K_CRASHES, kept.toString()).commit()
      } catch (_: Throwable) {
        // A wrongly typed key (corrupt store): start over with this crash.
        clearData(p, p.edit()).putString(K_CRASHES, JSONArray().put(crash).toString()).commit()
      }
    }
  }

  // A counter plus one; a negative (corrupt) count restarts at 1, and the
  // maximum stays put.
  fun inc(value: Int): Int = if (value < 0) 1 else if (value == Int.MAX_VALUE) value else value + 1

  // ---- reading ---------------------------------------------------------

  // The stored values; with `consume`, drained under the same lock.
  // Internal for the JVM tests (src/test), which pass their own store.
  fun read(store: SharedPreferences?, consume: Boolean): Stored {
    val p = store ?: return Stored()
    synchronized(lock) {
      val stored = try {
        parse(p)
      } catch (e: Exception) {
        Log.w(TAG, "telemetry store unreadable, resetting", e)
        reset(p)
        return Stored()
      } catch (_: Throwable) {
        return Stored()
      }
      if (consume) drain(p)
      return stored
    }
  }

  // What a consume clears: every counter, lastExitCode, lastDiedAt,
  // lastBootMs and the crashes (also keys an older build left). Two keys
  // stay: the on/off choice, and the stderr tail, which only the next
  // unexpected exit replaces (TelemetryRecorder.engineDied), so a report the
  // user sends later, even from a new process, can still attach it. Why
  // commit(), not apply(): the app stored what it peeked before it consumes
  // (telemetry.types.ts), so once consume returns the zeroes must be on disk;
  // an apply() still in flight when the process is killed would hand the
  // same counts to the next process, which would fold them a second time.
  // One small file, at background and boot only.
  private fun drain(p: SharedPreferences) {
    try {
      val e = p.edit()
      val all = try {
        p.all
      } catch (_: Throwable) {
        null
      }
      if (all == null) {
        for (key in DATA_KEYS) e.remove(key)
      } else {
        for ((key, value) in all) if (!keptByConsume(key, value)) e.remove(key)
      }
      e.commit()
    } catch (_: Throwable) {
    }
  }

  private fun keptByConsume(key: String, value: Any?): Boolean =
    (key == K_ENABLED && value is Boolean) || (key == K_STDERR_TAIL && value is String)

  // Every key a consume clears, for a store whose full listing fails.
  private val DATA_KEYS = listOf(
    K_LOW_MEMORY, K_STARTS, K_START_FAILS, K_DIED, K_PORT_SQUATS, K_EXIT_CODE,
    K_DIED_AT, K_BOOT_MS, K_TOOL_CALLS, K_SESSION_CREATES, K_CRASHES,
  )

  // Throws on any wrongly typed key or malformed JSON; the caller resets.
  private fun parse(p: SharedPreferences): Stored {
    val calls = JSONObject(p.getString(K_TOOL_CALLS, null) ?: "{}")
    val toolCalls = LinkedHashMap<String, Int>()
    for (key in calls.keys()) toolCalls[key] = calls.getInt(key).coerceAtLeast(0)
    val list = JSONArray(p.getString(K_CRASHES, null) ?: "[]")
    val crashes = ArrayList<Map<String, Any?>>(list.length())
    for (i in 0 until list.length()) crashes += crashMap(list.getJSONObject(i))
    return Stored(
      lowMemoryTrims = count(p, K_LOW_MEMORY),
      starts = count(p, K_STARTS),
      startFails = count(p, K_START_FAILS),
      died = count(p, K_DIED),
      portSquats = count(p, K_PORT_SQUATS),
      lastExitCode = if (p.contains(K_EXIT_CODE)) p.getInt(K_EXIT_CODE, 0) else null,
      lastDiedAt = if (p.contains(K_DIED_AT)) p.getLong(K_DIED_AT, 0L) else null,
      lastStderrTail = p.getString(K_STDERR_TAIL, null),
      lastBootMs = if (p.contains(K_BOOT_MS)) p.getLong(K_BOOT_MS, 0L) else null,
      toolCalls = toolCalls,
      sessionCreates = count(p, K_SESSION_CREATES),
      crashes = crashes,
    )
  }

  // One stored crash as a NativeCrash record; throws on a malformed entry.
  private fun crashMap(c: JSONObject): Map<String, Any?> {
    val framesJson = c.getJSONArray("frames")
    val frames = ArrayList<String>(framesJson.length())
    for (j in 0 until framesJson.length()) frames += framesJson.getString(j)
    return mapOf(
      "id" to c.getString("id"),
      "ts" to c.getLong("ts").toDouble(),
      "className" to c.getString("className"),
      "message" to c.getString("message"),
      "frames" to frames,
      "thread" to c.getString("thread"),
      "version" to c.getString("version"),
    )
  }

  private fun count(p: SharedPreferences, key: String): Int = p.getInt(key, 0).coerceAtLeast(0)

  // ---- reset -----------------------------------------------------------

  // A corrupt store starts over: every key but the on/off choice goes in one
  // write, the stderr tail too (it may be what is unreadable).
  private fun reset(p: SharedPreferences) {
    try {
      clearData(p, p.edit()).apply()
    } catch (_: Throwable) {
    }
  }

  // Removes every key but the on/off choice (that too when wrongly typed).
  private fun clearData(p: SharedPreferences, e: SharedPreferences.Editor): SharedPreferences.Editor {
    val all = try {
      p.all
    } catch (_: Throwable) {
      return e.clear()
    }
    for ((key, value) in all) if (key != K_ENABLED || value !is Boolean) e.remove(key)
    return e
  }
}
