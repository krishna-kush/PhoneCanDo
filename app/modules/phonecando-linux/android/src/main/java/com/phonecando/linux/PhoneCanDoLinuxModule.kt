package com.phonecando.linux

import com.phonecando.linux.api.linuxFunctions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PhoneCanDoLinuxModule : Module() {
  // Forwards the process-wide host's events to this module instance's JS.
  private val listener = object : LinuxHost.Listener {
    override fun onProgress(event: Map<String, Any?>) = sendEvent(PROGRESS, event)

    override fun onChanged() = sendEvent(CHANGED, emptyMap<String, Any?>())
  }

  @Volatile
  private var attached: LinuxHost? = null

  // The host, attached on first use: listening, and the records a process
  // death or cut-short delete left behind fixed (LinuxHost.recoverOnce).
  private fun host(): LinuxHost {
    attached?.let { return it }
    synchronized(this) {
      attached?.let { return it }
      val context = appContext.reactContext ?: throw Exception("no react context")
      val host = LinuxHost.get(context)
      host.addListener(listener)
      host.recoverOnce()
      attached = host
      return host
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoLinux")
    Events(PROGRESS, CHANGED)

    OnCreate {
      if (appContext.reactContext != null) host()
    }
    OnDestroy {
      attached?.removeListener(listener)
      attached = null
    }

    linuxFunctions { host() }
  }

  private companion object {
    const val PROGRESS = "phonecandoLinuxProgress"
    const val CHANGED = "phonecandoLinuxChanged"
  }
}
