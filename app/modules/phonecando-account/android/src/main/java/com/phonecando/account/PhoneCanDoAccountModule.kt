package com.phonecando.account

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The account's JS surface (src/PhoneCanDoAccountModule.ts); app/src/engine/account/
// is its only caller. The session token stays in AccountHost: no function
// returns it.
class PhoneCanDoAccountModule : Module() {
  private fun host(): AccountHost = AccountHost.get(appContext.reactContext ?: throw Exception("no react context"))

  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoAccount")

    Function("isSupported") { host().isSupported() }

    Function("isSignedIn") { host().isSignedIn() }

    // { email, name, photoUrl } | null.
    Function("profile") { host().profile()?.toMap() }

    // SignInResult: never rejects; a failure is { ok: false, error, message }.
    AsyncFunction("signIn") { baseUrl: String, webClientId: String, promise: Promise ->
      val host = host()
      val activity = appContext.currentActivity
      host.executor.execute { promise.resolve(host.signIn(activity, baseUrl, webClientId)) }
    }

    // { status, body }; rejects only for a host, route or method outside the accounts API.
    AsyncFunction("request") { baseUrl: String, method: String, path: String, body: String?, promise: Promise ->
      val host = host()
      host.executor.execute {
        try {
          promise.resolve(host.request(baseUrl, method, path, body))
        } catch (e: IllegalArgumentException) {
          promise.reject("not_allowed", e.message, e)
        } catch (e: Throwable) {
          promise.reject("failed", e.message, e)
        }
      }
    }

    AsyncFunction("signOut") { baseUrl: String, promise: Promise ->
      val host = host()
      host.executor.execute {
        // Signed out on this phone whatever the server said.
        runCatching { host.signOut(baseUrl) }
        promise.resolve(null)
      }
    }

    Function("clearLocal") { host().clearLocal() }
  }
}
