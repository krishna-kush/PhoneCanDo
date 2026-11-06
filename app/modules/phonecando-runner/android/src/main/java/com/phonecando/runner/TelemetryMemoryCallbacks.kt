package com.phonecando.runner

import android.content.ComponentCallbacks2
import android.content.res.Configuration

// Low-memory events for TelemetryRecorder.lowMemoryTrim; registered once per
// process by TelemetryRecorder.install. Counts real memory pressure only:
// TRIM_MEMORY_UI_HIDDEN (every trip to the background) and the LRU-list
// levels are not low memory. These levels and onLowMemory are deprecated in
// API 35 and Android 14+ no longer delivers them (only UI_HIDDEN and
// BACKGROUND), so there the counter stays 0; it is meaningful on Android
// 10-13.
@Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
internal object TelemetryMemoryCallbacks : ComponentCallbacks2 {
  override fun onTrimMemory(level: Int) {
    if (level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW ||
      level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL ||
      level >= ComponentCallbacks2.TRIM_MEMORY_COMPLETE
    ) {
      TelemetryRecorder.lowMemoryTrim()
    }
  }

  override fun onLowMemory() {
    TelemetryRecorder.lowMemoryTrim()
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
  }
}
