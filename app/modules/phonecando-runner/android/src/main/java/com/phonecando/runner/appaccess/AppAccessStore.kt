package com.phonecando.runner.appaccess

/** Where the user's answers about apps outlive the process. */
interface AppAccessStore {
  /** Apps saved as Always whose record checks out. */
  fun loadAlways(): Set<String>

  /** Saves [pkg] as Always; only works right after the user's biometric or PIN. */
  fun saveAlways(pkg: String): Boolean

  fun dropAlways(pkg: String)

  // Allow all's record also names the No list it was signed over, so a No
  // taken off behind our back turns Allow all off instead of letting that
  // app in.

  /** Allow all apps, when its record checks out over [blocked], the No list now. */
  fun loadAllowAll(blocked: Set<String>): Boolean

  /** Turns Allow all on over [blocked]; only works right after the user's biometric or PIN. */
  fun saveAllowAll(blocked: Set<String>): Boolean

  fun dropAllowAll()

  fun loadBlocked(): Set<String>

  fun saveBlocked(packages: Set<String>)
}
