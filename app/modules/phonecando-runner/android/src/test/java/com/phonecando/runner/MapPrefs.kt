package com.phonecando.runner

import android.content.SharedPreferences

// In-memory SharedPreferences with Android's editor semantics (clear first,
// then the edits in order; the last edit of a key wins), counting writes.
// The telemetry store tests run TelemetryStore and TelemetryRecorder over it.
class MapPrefs : SharedPreferences {
  val map = LinkedHashMap<String, Any>()
  var commits = 0
  var applies = 0

  override fun getAll(): MutableMap<String, *> = LinkedHashMap(map)

  override fun getString(key: String?, defValue: String?): String? = (map[key] as String?) ?: defValue

  override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? =
    (map[key] as? Set<*>)?.map { it as String }?.toMutableSet() ?: defValues

  override fun getInt(key: String?, defValue: Int): Int = (map[key] as Int?) ?: defValue

  override fun getLong(key: String?, defValue: Long): Long = (map[key] as Long?) ?: defValue

  override fun getFloat(key: String?, defValue: Float): Float = (map[key] as Float?) ?: defValue

  override fun getBoolean(key: String?, defValue: Boolean): Boolean = (map[key] as Boolean?) ?: defValue

  override fun contains(key: String?): Boolean = map.containsKey(key)

  override fun edit(): SharedPreferences.Editor = Editor()

  override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

  override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

  private inner class Editor : SharedPreferences.Editor {
    // A null value removes the key.
    private val edits = LinkedHashMap<String, Any?>()
    private var clear = false

    override fun putString(key: String?, value: String?) = put(key, value)

    override fun putStringSet(key: String?, values: MutableSet<String>?) = put(key, values?.toMutableSet())

    override fun putInt(key: String?, value: Int) = put(key, value)

    override fun putLong(key: String?, value: Long) = put(key, value)

    override fun putFloat(key: String?, value: Float) = put(key, value)

    override fun putBoolean(key: String?, value: Boolean) = put(key, value)

    override fun remove(key: String?) = put(key, null)

    override fun clear(): SharedPreferences.Editor {
      clear = true
      return this
    }

    override fun commit(): Boolean {
      write()
      commits++
      return true
    }

    override fun apply() {
      write()
      applies++
    }

    private fun put(key: String?, value: Any?): SharedPreferences.Editor {
      edits[requireNotNull(key)] = value
      return this
    }

    private fun write() {
      if (clear) map.clear()
      for ((k, v) in edits) if (v == null) map.remove(k) else map[k] = v
      edits.clear()
      clear = false
    }
  }
}
