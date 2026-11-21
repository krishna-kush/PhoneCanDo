package com.phonecando.runner.appaccess

/** What an agent may do with the app in front: go on, never, or ask the user first. */
enum class AppVerdict { ALLOWED, BLOCKED, ASK }

// The first time agents reach an app, the user is asked; this is the order
// the answers count in. No package (the screen in between, or one the
// service could not name) passes: the router checks the package the
// observe result names afterwards. PhoneCanDo and the home screen are
// never asked about. A "No" holds over everything, even Allow all; then
// Allow all, Always (one list for every agent) and the agent's own "Just
// now". Pure.
object AppAccessRules {
  fun verdict(
    pkg: String?,
    exempt: (String) -> Boolean,
    blocked: Set<String>,
    allowAll: Boolean,
    always: Set<String>,
    justNow: Set<String>,
  ): AppVerdict = when {
    pkg.isNullOrBlank() -> AppVerdict.ALLOWED
    exempt(pkg) -> AppVerdict.ALLOWED
    pkg in blocked -> AppVerdict.BLOCKED
    allowAll -> AppVerdict.ALLOWED
    pkg in always -> AppVerdict.ALLOWED
    pkg in justNow -> AppVerdict.ALLOWED
    else -> AppVerdict.ASK
  }

  // An Android package name (one segment for the system's own "android"),
  // so an agent's /app-access can't put words of its own in the question.
  private val PACKAGE = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)*")

  fun isPackageName(text: String): Boolean = text.length <= 255 && PACKAGE.matches(text)
}
