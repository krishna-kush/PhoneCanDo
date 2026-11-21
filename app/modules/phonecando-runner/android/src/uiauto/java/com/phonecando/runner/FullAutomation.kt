package com.phonecando.runner

import com.phonecando.runner.appaccess.AppGate
import org.json.JSONObject

// Full-only bridge to the PCE adapter. The bridge checks the phone-control
// lock (controllock/) before any call reaches it.
object FullAutomation : AutomationHost {
  override val connected: Boolean get() = PceAuto.service != null

  override fun describe(): JSONObject = pce().describe()
  override fun observe(options: JSONObject, gate: AppGate?): JSONObject = pce().observe(options, gate)
  override fun act(request: JSONObject, gate: AppGate?): JSONObject = pce().act(request, gate)
  override fun pack(request: JSONObject, gate: AppGate?): JSONObject = pce().pack(request, gate)
  override fun frontPackage(): String? = PceAuto.service?.frontPackage()

  private fun pce(): PceAutomation =
    PceAuto.service ?: throw AutomationUnavailableException("accessibility service not connected")
}
