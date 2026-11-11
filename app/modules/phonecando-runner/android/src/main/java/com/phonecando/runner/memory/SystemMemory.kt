package com.phonecando.runner.memory

import android.app.ActivityManager
import android.content.Context

// The phone's memory as Android reports it (ActivityManager.getMemoryInfo:
// one binder call, cheap enough every few seconds). Null when Android will
// not say.
internal class SystemMemory(context: Context) {
  private val am = context.getSystemService(ActivityManager::class.java)

  fun read(): MemoryReading? {
    val info = ActivityManager.MemoryInfo()
    try {
      am?.getMemoryInfo(info) ?: return null
    } catch (_: Exception) {
      return null
    }
    if (info.totalMem <= 0) return null
    return MemoryReading(info.totalMem, info.availMem, info.threshold, info.lowMemory)
  }
}
