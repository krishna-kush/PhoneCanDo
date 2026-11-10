package com.phonecando.models.device

import com.phonecando.lme.api.device.CpuCore
import java.io.File

/**
 * The CPU as the kernel describes it, for lme's DeviceInfo. Pure: the
 * texts and folders are passed in (`/proc/cpuinfo`, `/sys/devices/system/cpu`
 * on the phone).
 */
object CpuInfo {
  private val CORE_DIR = Regex("cpu([0-9]+)")

  /**
   * The features every core has: the intersection of each `Features` line
   * of `/proc/cpuinfo` (one per core on arm64). Empty when there is none.
   */
  fun features(cpuinfo: String): Set<String> {
    val lines = cpuinfo.lineSequence()
      .filter { it.substringBefore(':').trim().equals("Features", ignoreCase = true) && ':' in it }
      .map { line -> line.substringAfter(':').trim().split(WS).filter { it.isNotEmpty() }.toSet() }
      .toList()
    if (lines.isEmpty()) return emptySet()
    return lines.reduce { all, next -> all intersect next }
  }

  /**
   * One CpuCore per `cpuN` folder under [root], in core order: its
   * `cpu_capacity` and `cpufreq/cpuinfo_max_freq`, each null when missing
   * or unreadable.
   */
  fun cores(root: File): List<CpuCore> {
    val dirs = root.listFiles().orEmpty()
      .mapNotNull { dir -> CORE_DIR.matchEntire(dir.name)?.let { it.groupValues[1].toInt() to dir } }
      .filter { it.second.isDirectory }
      .sortedBy { it.first }
    return dirs.map { (_, dir) -> CpuCore(number(File(dir, "cpu_capacity")), number(File(dir, "cpufreq/cpuinfo_max_freq"))) }
  }

  private fun number(file: File): Long? = try {
    file.readText().trim().toLongOrNull()
  } catch (_: Exception) {
    null
  }

  private val WS = Regex("\\s+")
}
