package com.phonecando.runner.appaccess

// One screen call's app check inside the PCE (uiauto/appgate/), for the
// agent making it. The router judges the app in front when a call comes
// in, but a call goes on from there: a tap's expect or a wait reads the
// screen the tap opened (the app icon tapped on the home screen), a pack
// runs every step of its flow. So every look and every action in the call
// is judged again: a look by the app it shows, a launch by the app it
// opens, anything else by the app in front. A screenshot shows the whole
// screen, so every app window on it must pass too (split screen,
// picture-in-picture), and none is taken of the home screen, whose widgets
// and Recents cards show other apps. The first app refused ends the call;
// the router answers with its refusal. Pure: the verdicts and the home
// screen are injected.
class AppGate(
  private val allowed: (pkg: String) -> Boolean,
  private val home: (pkg: String) -> Boolean,
) {
  /** Take a screenshot, take none (the home screen), or refuse the look. */
  enum class Shot { TAKE, WITHHOLD, REFUSE }

  /** The first app this call was refused, null while none. */
  @Volatile
  var refused: String? = null
    private set

  // No package (the screen in between) passes, as in AppAccessRules.
  fun mayUse(pkg: String?): Boolean = pkg.isNullOrBlank() || allowed(pkg)

  fun allows(pkg: String?): Boolean {
    if (mayUse(pkg)) return true
    if (refused == null) refused = pkg
    return false
  }

  fun shot(front: String?, appWindows: List<String?>): Shot = when {
    !allows(front) || appWindows.any { !allows(it) } -> Shot.REFUSE
    front != null && home(front) -> Shot.WITHHOLD
    else -> Shot.TAKE
  }
}
