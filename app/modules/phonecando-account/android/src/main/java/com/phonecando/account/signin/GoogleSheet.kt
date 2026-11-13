package com.phonecando.account.signin

import android.app.Activity
import android.content.Context
import android.os.CancellationSignal
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit

/** What Google's sheet gave back: the ID token for our server, and who picked it (email, name, photo). */
class GoogleChoice(val idToken: String, val email: String, val name: String?, val photoUrl: String?)

/**
 * Google's account sheet through Android's Credential Manager (Sign in with
 * Google, the button flow: every Google account on the phone, and adding
 * one). Blocking: callers run it on the account executor, never the main
 * thread, while the sheet runs on the activity.
 */
object GoogleSheet {
  // Direct: the callbacks only hand a value to the waiting thread.
  private val direct = Executor { it.run() }

  /** Shows the sheet and waits for the pick; throws a SignInException or the sheet's own exception. */
  fun choose(activity: Activity, webClientId: String, nonce: String): GoogleChoice {
    val option = GetSignInWithGoogleOption.Builder(webClientId).setNonce(nonce).build()
    val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
    val manager = CredentialManager.create(activity)
    val cancel = CancellationSignal()
    val done = CountDownLatch(1)
    var response: GetCredentialResponse? = null
    var failure: GetCredentialException? = null
    activity.runOnUiThread {
      manager.getCredentialAsync(
        activity, request, cancel, direct,
        object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
          override fun onResult(result: GetCredentialResponse) {
            response = result
            done.countDown()
          }

          override fun onError(e: GetCredentialException) {
            failure = e
            done.countDown()
          }
        },
      )
    }
    // Someone who walks away from the sheet: give up after a while instead of holding the executor.
    if (!done.await(SHEET_TIMEOUT_MIN, TimeUnit.MINUTES)) {
      cancel.cancel()
      throw SignInException(SignInError.CANCELLED, "Google's sheet was left open")
    }
    failure?.let { throw it }
    val credential = response?.credential
    if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
      throw SignInException(SignInError.FAILED, "Google gave back another kind of credential")
    }
    val google = GoogleIdTokenCredential.createFrom(credential.data)
    return GoogleChoice(google.idToken, google.id, google.displayName, google.profilePictureUri?.toString())
  }

  /** Tells Credential Manager we signed out, so the sheet does not pick the last account by itself. Best effort. */
  fun clear(context: Context) {
    val done = CountDownLatch(1)
    try {
      CredentialManager.create(context).clearCredentialStateAsync(
        ClearCredentialStateRequest(), null, direct,
        object : CredentialManagerCallback<Void?, ClearCredentialException> {
          override fun onResult(result: Void?) = done.countDown()

          override fun onError(e: ClearCredentialException) = done.countDown()
        },
      )
      done.await(CLEAR_TIMEOUT_SEC, TimeUnit.SECONDS)
    } catch (_: Exception) {
      // no provider on this phone: nothing to clear
    }
  }

  private const val SHEET_TIMEOUT_MIN = 10L
  private const val CLEAR_TIMEOUT_SEC = 5L
}
