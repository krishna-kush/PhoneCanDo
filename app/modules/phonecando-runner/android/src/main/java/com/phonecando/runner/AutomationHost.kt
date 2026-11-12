package com.phonecando.runner

import org.json.JSONObject

// Main-source seam. The full-only implementation lives in src/uiauto; lite and
// play compile only this interface and install nothing. Who may drive is
// the phone-control lock's call (controllock/ControlLock), not the host's.
interface AutomationHost {
  val connected: Boolean
  fun describe(): JSONObject
  fun observe(options: JSONObject): JSONObject
  fun act(request: JSONObject): JSONObject
  fun pack(request: JSONObject): JSONObject
}

// A host call found the accessibility service gone after the bridge's
// connected check; the bridge answers 503 automation_unavailable for it.
class AutomationUnavailableException(message: String) : IllegalStateException(message)

object AutomationHosts {
  @Volatile
  var current: AutomationHost? = null

  // The first lookup's result is final, a miss included: lite/play would
  // otherwise throw and catch ClassNotFoundException on every bridge call.
  @Volatile
  private var looked = false

  // Reflection keeps the full adapter out of the main source set. Lite/play
  // have no FullAutomation class, so this stays null. Full keeps the class
  // and its INSTANCE field under R8 (consumer-rules-full.pro).
  fun install() {
    if (current != null || looked) return
    current = try {
      Class.forName("com.phonecando.runner.FullAutomation")
        .getField("INSTANCE")
        .get(null) as? AutomationHost
    } catch (_: Throwable) {
      null
    }
    looked = true
  }
}
