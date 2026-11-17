package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.update.SpecRules
import com.phonecando.runner.update.UpdateDownloads
import com.phonecando.runner.update.UpdateErrors
import com.phonecando.runner.update.UpdateEvents
import com.phonecando.runner.update.UpdateSpecException
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// PhoneCanDo's own update download for JS (update/; the state map is
// UpdateState.toMap): start one from latest.json's APK, stop and drop it,
// and read where it is. It runs natively, so it goes on with no JS around
// and after a process death. Every change is the phonecandoUpdateDownload
// event, the state map, through [emit] (UpdateEvents).
internal fun ModuleDefinitionBuilder.updateFunctions(context: () -> Context, emit: (Map<String, Any?>) -> Unit) {
  UpdateEvents.sink = emit

  // {url, name, size, sha256, versionCode, version} → the state map. On our
  // executor: replacing another spec's download waits for it to stop.
  // Rejects with bad_spec (not one of our release APKs), busy, stopped, or
  // the disk's code when the record will not write.
  AsyncFunction("startUpdateDownload") { spec: Map<String, Any?>, promise: Promise ->
    try {
      val parsed = SpecRules.parse(spec)
      val host = UpdateDownloads.get(context())
      host.executor.execute {
        try {
          promise.resolve(host.start(parsed).toMap())
        } catch (e: Throwable) {
          promise.reject(UpdateErrors.codeOf(e), UpdateErrors.lineOf(e), e)
        }
      }
    } catch (e: UpdateSpecException) {
      promise.reject(UpdateErrors.BAD_SPEC, e.message, e)
    } catch (e: Throwable) {
      promise.reject(UpdateErrors.codeOf(e), UpdateErrors.lineOf(e), e)
    }
  }

  // Stops the download and deletes all of it (its .part or finished APK,
  // the record, the resume entry). Never waits for the job to end.
  Function("stopUpdateDownload") {
    UpdateDownloads.get(context()).stop()
  }

  // The state map, or null when there is no record.
  Function("updateDownloadState") {
    UpdateDownloads.get(context()).state()?.toMap()
  }
}
