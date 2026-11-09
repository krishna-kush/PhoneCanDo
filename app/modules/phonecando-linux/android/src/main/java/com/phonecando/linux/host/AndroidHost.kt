package com.phonecando.linux.host

import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Process
import android.os.StatFs
import com.phonecando.linux.LinuxStatus
import com.phonecando.lre.api.HostEnv
import java.io.File

/** What the runtime needs from the phone, read from a Context. */
class AndroidHost(private val context: Context) {
  val filesDir: File get() = context.filesDir

  val libDir: String get() = context.applicationInfo.nativeLibraryDir

  /** Build channel from the manifest meta-data com.phonecando.channel (withBuildChannel.js); absent means full. */
  val channel: String by lazy {
    try {
      context.packageManager
        .getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        .metaData?.getString("com.phonecando.channel") ?: "full"
    } catch (_: Exception) {
      "full"
    }
  }

  fun status(): LinuxStatus = LinuxStatus.of(channel, libDir) { File(it).isFile }

  /** Read fresh each time: DNS follows the current network. */
  fun hostEnv(): HostEnv = HostEnv(
    libDir = libDir,
    dataDirSpellings = DataDirSpellings.of(context.packageName, context.dataDir.path, Process.myUid()),
    dnsServers = dnsServers(),
    hostPath = System.getenv("PATH") ?: DEFAULT_PATH,
  )

  /**
   * Whether the phone has a network that offers the internet (airplane mode
   * or no signal: false); null when Android won't say. Read fresh each time.
   */
  fun online(): Boolean? = try {
    val cm = context.getSystemService(ConnectivityManager::class.java)
    if (cm == null) {
      null
    } else {
      val caps = cm.activeNetwork?.let { cm.getNetworkCapabilities(it) }
      caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }
  } catch (_: Exception) {
    null
  }

  /** Free bytes where images and envs live. */
  fun freeBytes(): Long = StatFs(filesDir.path).availableBytes

  private fun dnsServers(): List<String> = try {
    val cm = context.getSystemService(ConnectivityManager::class.java)
    val network = cm?.activeNetwork
    val props = network?.let { cm.getLinkProperties(it) }
    props?.dnsServers?.mapNotNull { it.hostAddress }.orEmpty()
  } catch (_: Exception) {
    // No permission or no network: setup falls back to public resolvers.
    emptyList()
  }

  private companion object {
    const val DEFAULT_PATH = "/product/bin:/apex/com.android.runtime/bin:/apex/com.android.art/bin:/system_ext/bin:/system/bin:/system/xbin:/odm/bin:/vendor/bin:/vendor/xbin"
  }
}
