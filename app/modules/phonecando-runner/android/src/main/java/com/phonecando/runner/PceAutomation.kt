package com.phonecando.runner

import org.json.JSONObject

// Seam between the bridge (main source) and the PCE adapter (full-only
// source). Keeping PCE types out of main is what lets `play` builds compile
// the automation driver out without shipping PCE classes.
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
