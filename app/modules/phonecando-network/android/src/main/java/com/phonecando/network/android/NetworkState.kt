package com.phonecando.network.android

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/** Whether the phone has a network that offers the internet, read fresh each time. */
class NetworkState(context: Context) {
  private val manager = context.applicationContext.getSystemService(ConnectivityManager::class.java)

  /** True or false (airplane mode, no signal); null when Android won't say. */
  fun reading(): Boolean? {
    val m = manager ?: return null
    return try {
      m.getNetworkCapabilities(m.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    } catch (_: Exception) {
      null
    }
  }

  /** For a download: online unless we know it is not, so a phone that won't say only counts its tries. */
  fun online(): Boolean = reading() ?: true
}
