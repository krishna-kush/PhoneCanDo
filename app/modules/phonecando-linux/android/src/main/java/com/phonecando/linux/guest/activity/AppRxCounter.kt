package com.phonecando.linux.guest.activity

import android.net.TrafficStats
import android.os.Process

/**
 * The bytes this app's uid has received over the network since boot, all of
 * it: a guest script's downloads run under our uid, as does every engine and
 * WebView. Null where Android cannot count (TrafficStats.UNSUPPORTED).
 */
internal object AppRxCounter : RxCounter {
  override fun read(): Long? {
    val bytes = try {
      TrafficStats.getUidRxBytes(Process.myUid())
    } catch (_: RuntimeException) {
      return null
    }
    return if (bytes == TrafficStats.UNSUPPORTED.toLong() || bytes < 0) null else bytes
  }
}
