package com.phonecando.runner

import org.json.JSONObject

// Full-only adapter seam. The bridge sees only AutomationHost in main; lite and
// play compile this source set out, so no PCE class reaches their APK.
interface PceAutomation {
  fun describe(): JSONObject
  fun observe(options: JSONObject): JSONObject
  fun act(request: JSONObject): JSONObject
  fun pack(request: JSONObject): JSONObject
  fun close()
}

object PceAuto {
  @Volatile
  var service: PceAutomation? = null
    private set

  // Called by the accessibility service when it connects. Closing the previous
  // adapter prevents an old Pce instance from surviving a service restart.
  fun setService(next: PceAutomation?) {
    if (service !== next) service?.close()
    service = next
  }

  // Clear only if the destroyed service still owns the current adapter.
  fun clear(expected: PceAutomation?) {
    if (service === expected) {
      service?.close()
      service = null
    }
  }
}
