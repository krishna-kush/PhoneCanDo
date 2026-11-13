package com.phonecando.runner.pick

import android.app.Activity
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.text.format.DateFormat

// Android's own date and time dialogs, so a form can pick a day and a time
// without a picker library (the Schedules editor). Each shows over
// [activity] on its UI thread and answers once: what you picked, or null
// when you cancel (back, a tap outside, Cancel).
object PickDialogs {
  data class Date(val year: Int, val month: Int, val day: Int)

  data class Time(val hour: Int, val minute: Int)

  /** [month] is 1..12; [minMs]..[maxMs] (epoch ms) bound the days it offers. */
  fun date(activity: Activity, initial: Date, minMs: Long, maxMs: Long, done: (Date?) -> Unit) {
    activity.runOnUiThread {
      val once = Once(done)
      val dialog = DatePickerDialog(
        activity,
        { _, y, m, d -> once(Date(y, m + 1, d)) },
        initial.year,
        initial.month - 1,
        initial.day,
      )
      dialog.datePicker.minDate = minMs
      dialog.datePicker.maxDate = maxMs
      dialog.setOnDismissListener { once(null) }
      dialog.show()
    }
  }

  /** On the phone's own 12- or 24-hour clock. */
  fun time(activity: Activity, initial: Time, done: (Time?) -> Unit) {
    activity.runOnUiThread {
      val once = Once(done)
      val dialog = TimePickerDialog(
        activity,
        { _, h, m -> once(Time(h, m)) },
        initial.hour,
        initial.minute,
        DateFormat.is24HourFormat(activity),
      )
      dialog.setOnDismissListener { once(null) }
      dialog.show()
    }
  }

  // The pick comes before the dismiss that follows it; only the first counts.
  private class Once<T>(private val done: (T?) -> Unit) : (T?) -> Unit {
    private var answered = false

    override fun invoke(value: T?) {
      if (answered) return
      answered = true
      done(value)
    }
  }
}
