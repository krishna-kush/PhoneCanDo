package com.phonecando.models.device

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/**
 * Whether the phone has a network that offers the internet right now. A
 * download with none waits for one instead of using up its tries. When we
 * cannot tell, it answers true, so a download only counts its tries.
 */
class NetworkState(context: Context) {
  private val manager = context.getSystemService(ConnectivityManager::class.java)

  fun online(): Boolean {
    val m = manager ?: return true
    return try {
      m.getNetworkCapabilities(m.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    } catch (_: SecurityException) {
      true
    }
  }
}
