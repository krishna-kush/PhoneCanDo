package com.phonecando.runner.api

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// Plain text to and from the clipboard, for JS (engine/sharing.ts): an
// agent kind's JSON exported or imported. Android 13+ shows its own
// "copied" note, and lets an app read the clipboard only while it is in
// front, which is when JS asks.
internal fun ModuleDefinitionBuilder.clipboardFunctions(context: () -> Context) {
  // False when the clipboard is not there.
  Function("copyText") { text: String ->
    val cm = context().getSystemService(ClipboardManager::class.java) ?: return@Function false
    cm.setPrimaryClip(ClipData.newPlainText("PhoneCanDo", text))
    true
  }

  // The clipboard's text; null when it holds none.
  Function("clipboardText") {
    val ctx = context()
    val clip = ctx.getSystemService(ClipboardManager::class.java)?.primaryClip
    clip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(ctx)?.toString()?.ifEmpty { null }
  }
}
