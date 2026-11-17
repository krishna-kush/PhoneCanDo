package com.phonecando.runner.bridge

// What the user sees while an agent drives the phone. The full build's
// accessibility service sets [current] (uiauto/overlay/DrivingOverlay);
// lite and play have no driver and leave it null. DriverWatch calls show
// off the main thread, once per change of driver.
interface ScreenIndicator {
  /** [driver] drives the phone now (ScreenLease.driver); null: nobody does. */
  fun show(driver: ScreenLease.Seat?)

  companion object {
    @Volatile
    var current: ScreenIndicator? = null
  }
}

// Tells the indicator who drives, only when that changes or a new
// indicator came up (the service reconnected). The ticker checks every
// second, so the overlay goes once the driver has been idle the lease's
// time; a granted screen request and a take back check at once.
class DriverWatch(
  private val lease: ScreenLease,
  private val indicator: () -> ScreenIndicator? = { ScreenIndicator.current },
) {
  private var told: ScreenIndicator? = null
  private var shown: ScreenLease.Seat? = null

  @Synchronized
  fun check() {
    val now = indicator() ?: return
    val driver = lease.driver()
    if (now === told && driver == shown) return
    told = now
    shown = driver
    runCatching { now.show(driver) }
  }
}
