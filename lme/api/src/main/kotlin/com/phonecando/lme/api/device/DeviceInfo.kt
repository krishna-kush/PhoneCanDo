package com.phonecando.lme.api.device

/**
 * The phone as the host measured it: RAM from `ActivityManager.MemoryInfo`
 * (total and available bytes), the primary ABI (`Build.SUPPORTED_ABIS[0]`),
 * one [CpuCore] per core from `/sys/devices/system/cpu`, and the
 * `/proc/cpuinfo` features every core has (`asimddp`, `i8mm`, ...).
 */
data class DeviceInfo(
    val totalRamBytes: Long,
    val availableRamBytes: Long,
    val abi: String,
    val cores: List<CpuCore>,
    val cpuFeatures: Set<String>,
)

/**
 * One core: its `cpu_capacity` (the scheduler's relative speed) and its
 * `cpufreq/cpuinfo_max_freq`, each null when the kernel does not say.
 */
data class CpuCore(val capacity: Long?, val maxFreqKhz: Long?)
