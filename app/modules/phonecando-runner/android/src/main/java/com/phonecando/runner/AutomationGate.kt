package com.phonecando.runner

// Master switch for phone control. In-memory and default off: it dies with the
// app process, so a forgotten toggle cannot stay armed across restarts. Only
// the app UI flips it (after biometric auth); the agent process cannot.
object AutomationGate {
  @Volatile
  var enabled = false
}
