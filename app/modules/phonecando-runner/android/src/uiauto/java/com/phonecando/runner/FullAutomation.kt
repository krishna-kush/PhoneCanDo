package com.phonecando.runner

import org.json.JSONObject

// Full-only bridge to the PCE adapter. The bridge checks the phone-control
// lock (controllock/) before any call reaches it.
object FullAutomation : AutomationHost {
  override val connected: Boolean get() = PceAuto.service != null

  override fun describe(): JSONObject = pce().describe()
  override fun observe(options: JSONObject): JSONObject = pce().observe(options)
  override fun act(request: JSONObject): JSONObject = pce().act(request)
  override fun pack(request: JSONObject): JSONObject = pce().pack(request)

  private fun pce(): PceAutomation =
    PceAuto.service ?: throw AutomationUnavailableException("accessibility service not connected")
}
