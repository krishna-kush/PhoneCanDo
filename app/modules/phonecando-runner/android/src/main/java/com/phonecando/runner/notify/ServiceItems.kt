package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.util.Log

// Posts the service's items (ServicePlan), each a notification of its own
// under its key as the tag: only one that changed is posted again, as
// Android drops an app's updates past about five a second, and one gone is
// taken down. They are ordinary notifications, so they outlive a process
// that dies: [clearStale] takes down what an earlier process left.
// Main thread only.
internal class ServiceItems(private val context: Context) {
  private class Shown(val item: ServiceItem, val sortKey: String, val since: Long)

  private val shown = LinkedHashMap<String, Shown>()

  /** Shows [items], in this order; [build] makes one's notification from it, its sort key and when it first showed. */
  fun show(items: List<ServiceItem>, build: (ServiceItem, String, Long) -> Notification) {
    val keys = items.mapTo(HashSet()) { it.key }
    shown.keys.filter { it !in keys }.forEach(::cancel)
    items.forEachIndexed { i, item ->
      val sortKey = i.toString().padStart(3, '0')
      val last = shown[item.key]
      if (last != null && last.item == item && last.sortKey == sortKey) return@forEachIndexed
      val since = last?.since ?: System.currentTimeMillis()
      try {
        manager().notify(tag(item.key), ServiceNotification.ITEM_ID, build(item, sortKey, since))
        shown[item.key] = Shown(item, sortKey, since)
      } catch (e: Exception) {
        Log.w(TAG, "item notification failed", e)
      }
    }
  }

  /** Takes every item down (nothing runs, the service ends). */
  fun clear() {
    shown.keys.toList().forEach(::cancel)
  }

  /** Takes down the items an earlier process left (the service's first start). */
  fun clearStale() {
    try {
      val manager = manager()
      manager.activeNotifications
        .filter { it.id == ServiceNotification.ITEM_ID && it.tag?.startsWith(TAG_PREFIX) == true }
        .forEach { manager.cancel(it.tag, it.id) }
    } catch (e: Exception) {
      Log.w(TAG, "stale items not cleared", e)
    }
  }

  private fun cancel(key: String) {
    shown.remove(key)
    try {
      manager().cancel(tag(key), ServiceNotification.ITEM_ID)
    } catch (e: Exception) {
      Log.w(TAG, "item notification not cancelled", e)
    }
  }

  private fun manager() = context.getSystemService(NotificationManager::class.java)

  private fun tag(key: String) = TAG_PREFIX + key

  private companion object {
    const val TAG = "PhoneCanDoItems"
    const val TAG_PREFIX = "phonecando-item:"
  }
}
