package com.phonecando.models.device

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import com.phonecando.lme.api.device.CpuCore
import com.phonecando.lme.api.device.DeviceInfo
import java.io.File

/**
 * The phone as lme needs it (DeviceInfo): RAM from
 * `ActivityManager.MemoryInfo`, read fresh each time; the ABI, cores and CPU
 * features, read once (they never change while we run).
 */
class DeviceReader(private val context: Context) {
  private val cores: List<CpuCore> by lazy {
    try {
      CpuInfo.cores(File("/sys/devices/system/cpu"))
    } catch (_: Exception) {
      emptyList()
    }
  }

  private val features: Set<String> by lazy {
    try {
      CpuInfo.features(File("/proc/cpuinfo").readText())
    } catch (_: Exception) {
      emptySet()
    }
  }

  fun read(): DeviceInfo {
    val memory = ActivityManager.MemoryInfo()
    context.getSystemService(ActivityManager::class.java)?.getMemoryInfo(memory)
    return DeviceInfo(
      totalRamBytes = memory.totalMem,
      availableRamBytes = memory.availMem,
      abi = Build.SUPPORTED_ABIS.firstOrNull().orEmpty(),
      cores = cores,
      cpuFeatures = features,
    )
  }
}
