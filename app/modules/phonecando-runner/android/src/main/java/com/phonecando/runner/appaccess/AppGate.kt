package com.phonecando.runner.appaccess

// One screen call's app check inside the PCE (uiauto/appgate/), for the
// agent making it. The router judges the app in front when a call comes
// in, but a call goes on from there: a tap's expect or a wait reads the
// screen the tap opened (the app icon tapped on the home screen), a pack
// runs every step of its flow. So every look and every action in the call
// is judged again: a look by the app it shows, a launch by the app it
// opens, anything else by the app in front. Parts of other apps inside the
// window (ForeignParts: a widget, a notification row) are left out of the
// look unless the agent may use their app, and a tap on one is refused. A
// screenshot shows the whole screen, so every app window on it must pass
// too (split screen, picture-in-picture), and none is taken of the home
// screen, whose widgets and Recents cards show other apps. The first app
// refused ends the call; the router answers with its refusal. Pure: the
// verdicts, the home screen and the names are injected.
class AppGate(
  val agentId: String,
  private val allowed: (pkg: String) -> Boolean,
  private val home: (pkg: String) -> Boolean,
  private val labels: (pkg: String) -> String = { it },
) {
  /** Take a screenshot, take none (the home screen), or refuse the look. */
  enum class Shot { TAKE, WITHHOLD, REFUSE }

  /** A part a look left out: its app (null when none has its name), the name, a widget or a notification. */
  data class Hidden(val pkg: String?, val label: String, val what: String)

  /** The first app this call was refused, null while none. */
  @Volatile
  var refused: String? = null
    private set

  /** A tap on a notification whose app nobody can name: the name it shows. */
  @Volatile
  var refusedUnnamed: String? = null
    private set

  private val left = LinkedHashSet<Hidden>()

  /** What the call's looks left out, each once. */
  val hidden: List<Hidden> @Synchronized get() = left.toList()

  // No package (the screen in between) passes, as in AppAccessRules.
  fun mayUse(pkg: String?): Boolean = pkg.isNullOrBlank() || allowed(pkg)

  fun allows(pkg: String?): Boolean {
    if (mayUse(pkg)) return true
    if (refused == null) refused = pkg
    return false
  }

  /** Whether a look may show [part]: it needs an app with its name, and every such app allowed. */
  fun mayShow(part: ForeignParts.Part): Boolean = part.packages.isNotEmpty() && part.packages.all(::mayUse)

  @Synchronized
  fun hid(part: ForeignParts.Part) {
    val pkg = part.packages.firstOrNull { !mayUse(it) }
    left += Hidden(pkg, part.label ?: pkg?.let(labels) ?: "an app", part.kind.name.lowercase())
  }

  /** Whether a tap may land on [part]; a refusal is kept for the router. */
  fun mayTap(part: ForeignParts.Part): Boolean {
    if (mayShow(part)) return true
    val pkg = part.packages.firstOrNull { !mayUse(it) }
    if (pkg != null) return allows(pkg)
    if (refused == null && refusedUnnamed == null) refusedUnnamed = part.label ?: "an app"
    return false
  }

  fun shot(front: String?, appWindows: List<String?>): Shot = when {
    !allows(front) || appWindows.any { !allows(it) } -> Shot.REFUSE
    front != null && home(front) -> Shot.WITHHOLD
    else -> Shot.TAKE
  }
}
