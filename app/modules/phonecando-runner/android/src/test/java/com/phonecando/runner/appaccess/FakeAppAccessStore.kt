package com.phonecando.runner.appaccess

// The Keystore store's contract in memory: Always and Allow all save only
// while `authed` (the user has just authenticated); the rest always does.
// Allow all's record is the No list it was signed over (`allowAllOver`),
// null while off.
class FakeAppAccessStore(
  val always: MutableSet<String> = mutableSetOf(),
  var allowAllOver: Set<String>? = null,
  var blocked: Set<String> = emptySet(),
  var authed: Boolean = true,
) : AppAccessStore {
  val allowAll: Boolean get() = allowAllOver != null

  override fun loadAlways(): Set<String> = always.toSet()

  override fun saveAlways(pkg: String): Boolean {
    if (!authed) return false
    always += pkg
    return true
  }

  override fun dropAlways(pkg: String) {
    always -= pkg
  }

  override fun loadAllowAll(blocked: Set<String>): Boolean = allowAllOver == blocked

  override fun saveAllowAll(blocked: Set<String>): Boolean {
    if (!authed) return false
    allowAllOver = blocked.toSet()
    return true
  }

  override fun dropAllowAll() {
    allowAllOver = null
  }

  override fun loadBlocked(): Set<String> = blocked

  override fun saveBlocked(packages: Set<String>) {
    blocked = packages.toSet()
  }
}

const val OWN = "com.phonecando.app"
const val HOME = "com.android.launcher3"

/** An app list over [store] that never asks about PhoneCanDo or the home screen, labels "Name of <pkg>". */
fun appAccess(store: FakeAppAccessStore = FakeAppAccessStore()): AppAccess =
  AppAccess(store, { it == OWN || it == HOME }, { "Name of $it" })
