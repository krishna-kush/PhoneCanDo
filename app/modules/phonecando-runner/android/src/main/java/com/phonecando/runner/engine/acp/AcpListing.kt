package com.phonecando.runner.engine.acp

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.File

// Whether each kind's ACP mode lists its chats (session/list), as it said
// the last time it started (AcpCaps.list), kept in files/state/ so it
// holds across restarts. A kind that lists them can go on in ACP mode in
// the chat its terminal left (the newest it lists, AcpChats); one that
// doesn't, or that never ran in ACP mode yet, can't, and nobody stops its
// terminal for that (presence/ResumeRules). Every start writes it again,
// so an update that adds or drops the list counts from its next start.
internal object AcpListing {
  private const val TAG = "PhoneCanDoAcp"
  private val lock = Any()

  /** [kindId]'s ACP mode listed its chats when it last started; false when it didn't or never started. */
  fun lists(context: Context, kindId: String): Boolean = synchronized(lock) { read(file(context)).optBoolean(kindId, false) }

  /** What [kindId]'s ACP mode said now. */
  fun save(context: Context, kindId: String, lists: Boolean) {
    synchronized(lock) {
      val file = file(context)
      val all = read(file)
      if (all.has(kindId) && all.optBoolean(kindId) == lists) return
      try {
        file.parentFile?.mkdirs()
        val tmp = File(file.parentFile, "${file.name}.tmp")
        tmp.writeText(all.put(kindId, lists).toString())
        if (!tmp.renameTo(file)) Log.w(TAG, "ACP listing not saved")
      } catch (e: Exception) {
        Log.w(TAG, "ACP listing not saved: ${e.javaClass.simpleName}")
      }
    }
  }

  private fun read(file: File): JSONObject = try {
    if (file.isFile) JSONObject(file.readText()) else JSONObject()
  } catch (e: Exception) {
    JSONObject()
  }

  private fun file(context: Context) = File(File((context.applicationContext ?: context).filesDir, "state"), "acp-listing.json")
}
