package com.phonecando.runner.presence.glass.motion

// Eyes acting inside a move, as plain functions of its time: pupils that
// hold on a spot and dart to the next (eyes never drift when they look
// about, they jump), and one blink at a chosen moment.
object Glance {
  /**
   * Where the pupils point [t] ms in, given [stops]: each a time and a
   * gaze, held until the next and reached in a quick [dartMs] dart.
   */
  fun dart(t: Long, stops: List<Pair<Long, Pt>>, dartMs: Long = DART_MS): Pt {
    require(stops.isNotEmpty())
    var gaze = stops.first().second
    for ((at, next) in stops.drop(1)) {
      if (t < at) break
      val p = Ease.out(Ease.clamp((t - at).toFloat() / dartMs))
      gaze = Pt(Ease.mix(gaze.x, next.x, p), Ease.mix(gaze.y, next.y, p))
    }
    return gaze
  }

  /** How shut the lids are [t] ms in for one blink starting [at], [ms] long: 0 open to 1 shut. */
  fun blink(t: Long, at: Long, ms: Long = BLINK_MS): Float =
    if (t < at || t >= at + ms) 0f else Ease.arch((t - at).toFloat() / ms)

  const val DART_MS = 70L
  const val BLINK_MS = 170L
}
