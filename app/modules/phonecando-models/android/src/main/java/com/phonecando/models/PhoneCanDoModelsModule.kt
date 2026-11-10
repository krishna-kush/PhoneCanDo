package com.phonecando.models

import com.phonecando.models.api.modelFunctions
import com.phonecando.models.picker.FilePicker
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PhoneCanDoModelsModule : Module() {
  // Forwards the process-wide host's events to this module instance's JS.
  private val listener = object : ModelsHost.Listener {
    override fun onProgress(event: Map<String, Any?>) = sendEvent(PROGRESS, event)

    override fun onChanged() = sendEvent(CHANGED, emptyMap<String, Any?>())
  }

  private val picker = FilePicker()

  @Volatile
  private var attached: ModelsHost? = null

  private fun host(): ModelsHost {
    attached?.let { return it }
    synchronized(this) {
      attached?.let { return it }
      val context = appContext.reactContext ?: throw Exception("no react context")
      val host = ModelsHost.get(context)
      host.addListener(listener)
      attached = host
      return host
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoModels")
    Events(PROGRESS, CHANGED)

    OnCreate {
      if (appContext.reactContext != null) host()
    }
    OnDestroy {
      attached?.removeListener(listener)
      attached = null
    }
    OnActivityResult { _, payload ->
      picker.onResult(payload.requestCode, payload.resultCode, payload.data)
    }

    modelFunctions(::host, picker) { appContext.currentActivity }
  }

  private companion object {
    const val PROGRESS = "phonecandoModelsProgress"
    const val CHANGED = "phonecandoModelsChanged"
  }
}
