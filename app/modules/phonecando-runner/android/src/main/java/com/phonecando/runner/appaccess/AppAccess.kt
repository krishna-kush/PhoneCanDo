package com.phonecando.runner.appaccess

// Which apps agents may reach (the bridge's 403 app_not_allowed and
// app_blocked), one list for every agent: Always and Allow all only right
// after the user's biometric or PIN (the store signs them), No and taking
// an app off the list need none (they only ask more), and each agent's Just
// now in memory. Allow all's record signs the No list too, so while it is
// on, taking a No off needs the biometric (it lets that app in), and a new
// No signs it again or, with no biometric just now, turns Allow all off: a
// No always holds. The saved answers are read once and kept here, so a
// screen call never waits on the Keystore. Pure: the store, the apps never
// asked about, the labels and the home screen are injected.
class AppAccess(
  private val store: AppAccessStore,
  private val exempt: (String) -> Boolean,
  private val labels: (String) -> String,
  private val home: (String) -> Boolean = { false },
) {
  /** One app on the Settings list. */
  data class Entry(val pkg: String, val label: String, val state: String)

  private val justNow = JustNowGrants()

  @Volatile
  private var always: Set<String> = store.loadAlways()

  @Volatile
  private var blocked: Set<String> = store.loadBlocked()

  @Volatile
  var allowAll: Boolean = store.loadAllowAll(blocked)
    private set

  fun verdict(pkg: String?, agentId: String): AppVerdict =
    AppAccessRules.verdict(pkg, exempt, blocked, allowAll, always, justNow.of(agentId))

  /** The check inside one screen call of [agentId] (AppGate), on the answers as they stand then. */
  fun gate(agentId: String) = AppGate(agentId, { verdict(it, agentId) == AppVerdict.ALLOWED }, home, labels)

  /** The app's name as the phone shows it, else its package. */
  fun label(pkg: String): String = labels(pkg)

  /** "Just now": [agentId] may use [pkg] until it hands the phone back or stops. */
  fun grantOnce(agentId: String, pkg: String) = justNow.grant(agentId, pkg)

  // "Always", right after the biometric; it also lifts a "No", which under
  // Allow all signs that again in the same window (else the Always is
  // taken back and nothing changes). When the save fails, what the store
  // reads stands (a failed sign may have voided an earlier Always).
  @Synchronized
  fun setAlways(pkg: String): Boolean {
    if (!store.saveAlways(pkg)) {
      always = store.loadAlways()
      return false
    }
    if (pkg in blocked && !unblock(pkg)) {
      store.dropAlways(pkg)
      return false
    }
    always = always + pkg
    return true
  }

  // "No": blocked for every agent until changed in Settings, Allow all
  // included. It always holds: under Allow all it signs that again, or
  // turns it off when there was no biometric just now.
  @Synchronized
  fun block(pkg: String) {
    if (pkg !in blocked) {
      val next = blocked + pkg
      saveBlocked(next)
      if (allowAll && !store.saveAllowAll(next)) {
        store.dropAllowAll()
        allowAll = false
      }
    }
    dropAlways(pkg)
    justNow.dropApp(pkg)
  }

  // Off the list both ways: the next agent to reach it asks again. Taking
  // a No off under Allow all lets the app in, so it needs the biometric
  // (false, nothing changed, without it).
  @Synchronized
  fun forget(pkg: String): Boolean {
    if (pkg in blocked && !unblock(pkg)) return false
    dropAlways(pkg)
    justNow.dropApp(pkg)
    return true
  }

  // On only right after the biometric; off needs nothing. Answers the
  // switch as kept.
  @Synchronized
  fun setAllowAll(on: Boolean): Boolean {
    if (on) {
      allowAll = store.saveAllowAll(blocked) || store.loadAllowAll(blocked)
    } else {
      store.dropAllowAll()
      allowAll = false
    }
    return allowAll
  }

  /** Every app with an answer, "blocked" over "always", by label. */
  fun entries(): List<Entry> {
    val no = blocked
    val yes = always - no
    return (yes.map { Entry(it, labels(it), ALWAYS) } + no.map { Entry(it, labels(it), BLOCKED) })
      .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER, Entry::label).thenBy(Entry::pkg))
  }

  /** The agent handed the phone back or its engine stopped. */
  fun endJustNow(agentId: String) = justNow.end(agentId)

  fun endAllJustNow() = justNow.clear()

  // Takes [pkg] off the No list; under Allow all only once its record is
  // signed over the shorter list, so a crash between the two reads as off.
  private fun unblock(pkg: String): Boolean {
    val next = blocked - pkg
    if (allowAll && !store.saveAllowAll(next)) return false
    saveBlocked(next)
    return true
  }

  private fun saveBlocked(next: Set<String>) {
    blocked = next
    store.saveBlocked(next)
  }

  // The store drops it even when it never checked out here, so a record
  // the Keystore could not read at start never comes back after a restart.
  private fun dropAlways(pkg: String) {
    store.dropAlways(pkg)
    always = always - pkg
  }

  companion object {
    const val ALWAYS = "always"
    const val BLOCKED = "blocked"
  }
}
