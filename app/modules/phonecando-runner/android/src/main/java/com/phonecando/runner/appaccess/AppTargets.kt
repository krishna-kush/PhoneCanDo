package com.phonecando.runner.appaccess

import org.json.JSONObject

// The app a /pce/act request opens, when it is a launch. A launch is judged
// by where it goes, not where it starts: asked from PhoneCanDo's chat
// (never asked about), "open WhatsApp" would otherwise get through and ask
// only at the first look inside. The action may come as an object or as
// its JSON text, as PceAutomationImpl takes it. Pure.
object AppTargets {
  /** The launched package, or null when the request is no launch. */
  fun launched(request: JSONObject): String? {
    val action = when (val raw = request.opt("action")) {
      is JSONObject -> raw
      is String -> runCatching { JSONObject(raw) }.getOrNull()
      else -> null
    } ?: return null
    if (action.optString("type") != "launch") return null
    return action.optString("packageName").trim().takeIf { it.isNotEmpty() }
  }
}
