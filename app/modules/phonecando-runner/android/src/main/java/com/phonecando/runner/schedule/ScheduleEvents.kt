package com.phonecando.runner.schedule

// Tells the app the schedules or their runs changed (the phonecandoSchedules
// event, {}). The native module sets [listener] when it is made; with none
// attached nothing is sent, and the app reads listSchedules and
// scheduleRuns when it comes back.
object ScheduleEvents {
  const val NAME = "phonecandoSchedules"

  @Volatile
  var listener: (() -> Unit)? = null

  fun changed() {
    val send = listener ?: return
    try {
      send()
    } catch (_: Exception) {
      // The module is gone; the next one reads it all again.
    }
  }
}
