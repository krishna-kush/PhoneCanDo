package com.phonecando.account.api

/**
 * Where the session token may go. JS names the base URL, so this is the
 * guard that keeps the token on our own accounts routes: our API host, or,
 * in debug builds only, the local dev host on loopback (`pnpm -C tce dev`
 * with `adb reverse`). A release build never sends it to loopback, where any
 * other app on the phone could be listening.
 */
object ApiTargets {
  const val RELEASE_BASE = "https://api.phonecando.app"

  private val LOOPBACK = Regex("^http://127\\.0\\.0\\.1:[0-9]{1,5}$")
  private val PATH = Regex("^/v1/account(/[a-z]{1,32})?$")
  private val METHODS = setOf("GET", "POST", "PUT")

  fun baseAllowed(baseUrl: String, debuggable: Boolean): Boolean =
    baseUrl == RELEASE_BASE || (debuggable && LOOPBACK.matches(baseUrl))

  /** `/v1/account` and its one-word routes (`/v1/account/shares`); nothing else. */
  fun pathAllowed(path: String): Boolean = PATH.matches(path)

  fun methodAllowed(method: String): Boolean = method in METHODS
}
