package com.phonecando.runner.schedule

import android.content.Context
import android.text.format.DateFormat
import java.util.Date
import java.util.Locale

// A time as the phone shows one, in its language and its 12- or 24-hour
// setting: "Fri 14 Nov, 09:00" (schedule_add's nextAtText).
object PhoneTime {
  fun text(context: Context): (Long) -> String {
    val app = context.applicationContext ?: context
    return { ms ->
      val skeleton = if (DateFormat.is24HourFormat(app)) "EEEdMMMHHmm" else "EEEdMMMhmma"
      val pattern = DateFormat.getBestDateTimePattern(Locale.getDefault(), skeleton)
      DateFormat.format(pattern, Date(ms)).toString()
    }
  }
}
