package com.phonecando.runner

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri

// Installs TelemetryRecorder (crash handler, memory callbacks) at process
// start. Android creates a library's content providers after the Application
// object exists and before Application.onCreate, in every process start: app
// launch, a system restart of the serve service, a broadcast receiver such as
// PackageReplacedReceiver. That is the earliest hook a library gets without
// app code, so crashes inside React Native's own startup (native library
// loading, host creation) are recorded too. Expo's ApplicationLifecycleListener
// runs at the end of MainApplication.onCreate and the module's OnCreate only
// once JS loads, both later. Not exported; it serves no data.
class TelemetryInitProvider : ContentProvider() {
  override fun onCreate(): Boolean {
    context?.let { TelemetryRecorder.install(it) }
    return true
  }

  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?,
  ): Cursor? = null

  override fun getType(uri: Uri): String? = null

  override fun insert(uri: Uri, values: ContentValues?): Uri? = null

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

  override fun update(
    uri: Uri,
    values: ContentValues?,
    selection: String?,
    selectionArgs: Array<out String>?,
  ): Int = 0
}
