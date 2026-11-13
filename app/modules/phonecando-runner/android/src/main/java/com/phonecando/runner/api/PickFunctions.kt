package com.phonecando.runner.api

import android.app.Activity
import com.phonecando.runner.pick.PickDialogs
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// Android's date and time dialogs for JS (pick/PickDialogs). Each resolves
// with what you picked, or null when you cancel or no screen is showing.
internal fun ModuleDefinitionBuilder.pickFunctions(activity: () -> Activity?) {
  // {year, month (1..12), day} | null; minMs..maxMs (epoch ms) bound the days.
  AsyncFunction("pickDate") { year: Int, month: Int, day: Int, minMs: Double, maxMs: Double, promise: Promise ->
    val screen = activity() ?: return@AsyncFunction promise.resolve(null)
    PickDialogs.date(screen, PickDialogs.Date(year, month, day), minMs.toLong(), maxMs.toLong()) { picked ->
      promise.resolve(picked?.let { mapOf("year" to it.year, "month" to it.month, "day" to it.day) })
    }
  }

  // {hour (0..23), minute} | null.
  AsyncFunction("pickTime") { hour: Int, minute: Int, promise: Promise ->
    val screen = activity() ?: return@AsyncFunction promise.resolve(null)
    PickDialogs.time(screen, PickDialogs.Time(hour, minute)) { picked ->
      promise.resolve(picked?.let { mapOf("hour" to it.hour, "minute" to it.minute) })
    }
  }
}
