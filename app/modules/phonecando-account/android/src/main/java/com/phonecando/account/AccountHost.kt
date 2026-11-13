package com.phonecando.account

import android.app.Activity
import android.content.Context
import android.content.pm.ApplicationInfo
import com.phonecando.account.api.AccountHttp
import com.phonecando.account.api.AccountWire
import com.phonecando.account.api.ApiTargets
import com.phonecando.account.session.AccountProfile
import com.phonecando.account.session.ProfileFile
import com.phonecando.account.session.SessionVault
import com.phonecando.account.signin.GoogleSheet
import com.phonecando.account.signin.SignInError
import com.phonecando.account.signin.SignInErrors
import com.phonecando.account.signin.SignInException
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The phone's side of an account, process-wide: the session token (sealed
 * in the Keystore), the profile, and the flows that use them. Every blocking
 * call runs on [executor], one at a time. The token never leaves this class
 * except as the Bearer of a request to an allowed accounts route.
 */
class AccountHost private constructor(private val app: Context) {
  val executor: ExecutorService = Executors.newSingleThreadExecutor { r ->
    Thread(r, "phonecando-account").apply { isDaemon = true }
  }

  private val dir = File(app.noBackupFilesDir, "account")
  private val vault = SessionVault(File(dir, "session"))
  private val profiles = ProfileFile(File(dir, "profile.json"))
  private val http = AccountHttp()
  private val debuggable = (app.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

  fun isSupported(): Boolean = PlayServices.installed(app)

  fun isSignedIn(): Boolean = vault.has()

  fun profile(): AccountProfile? = if (vault.has()) profiles.read() else null

  /** Nonce, Google's sheet, /v1/account/signin, then the token and profile are kept. Blocking; a SignInResult map. */
  fun signIn(activity: Activity?, baseUrl: String, webClientId: String): Map<String, Any?> = try {
    if (webClientId.isBlank()) throw SignInException(SignInError.NOT_CONFIGURED, "no Google client in this build")
    if (!ApiTargets.baseAllowed(baseUrl, debuggable)) throw SignInException(SignInError.FAILED, "not our accounts host")
    if (!isSupported()) throw SignInException(SignInError.UNAVAILABLE, "Google Play services is not on this phone")
    val screen = activity ?: throw SignInException(SignInError.FAILED, "no screen to show Google's sheet on")

    val nonceAnswer = http.send("$baseUrl/v1/account/nonce", "POST", null, null)
    if (nonceAnswer.status != 200) {
      throw SignInException(SignInErrors.ofAnswer(nonceAnswer.status, AccountWire.errorCode(nonceAnswer.body)), "nonce: HTTP ${nonceAnswer.status}")
    }
    val nonce = AccountWire.nonce(nonceAnswer.body) ?: throw SignInException(SignInError.FAILED, "nonce: unexpected answer")

    val choice = GoogleSheet.choose(screen, webClientId, nonce)

    val answer = http.send("$baseUrl/v1/account/signin", "POST", AccountWire.signInBody(choice.idToken, nonce), null)
    if (answer.status != 200) {
      throw SignInException(SignInErrors.ofAnswer(answer.status, AccountWire.errorCode(answer.body)), "sign-in: HTTP ${answer.status}")
    }
    val signed = AccountWire.signedIn(answer.body) ?: throw SignInException(SignInError.FAILED, "sign-in: unexpected answer")
    val profile = AccountProfile(choice.email, choice.name, choice.photoUrl)
    vault.save(signed.token)
    profiles.write(profile)
    mapOf("ok" to true, "profile" to profile.toMap(), "account" to signed.accountJson)
  } catch (e: Throwable) {
    mapOf("ok" to false, "error" to SignInErrors.of(e).code, "message" to e.message)
  }

  /**
   * One accounts call with the token as Bearer; { status, body }. Signed out
   * answers 401 without a request; a 401 from the server drops the token.
   */
  fun request(baseUrl: String, method: String, path: String, body: String?): Map<String, Any?> {
    require(ApiTargets.baseAllowed(baseUrl, debuggable)) { "not our accounts host" }
    require(ApiTargets.pathAllowed(path)) { "not an accounts route: $path" }
    require(ApiTargets.methodAllowed(method)) { "method $method" }
    val token = vault.read() ?: return mapOf("status" to 401, "body" to SIGNED_OUT)
    val answer = http.send(baseUrl + path, method, body, token)
    if (answer.status == 401) clearLocal()
    return mapOf("status" to answer.status, "body" to answer.body)
  }

  /** Tells the server (best effort), clears Credential Manager's state, then the token and profile. */
  fun signOut(baseUrl: String) {
    try {
      val token = vault.read()
      if (token != null && ApiTargets.baseAllowed(baseUrl, debuggable)) {
        http.send("$baseUrl/v1/account/signout", "POST", null, token)
      }
      GoogleSheet.clear(app)
    } finally {
      clearLocal()
    }
  }

  fun clearLocal() {
    vault.clear()
    profiles.clear()
  }

  companion object {
    private const val SIGNED_OUT = "{\"error\":\"signed_out\"}"

    @Volatile
    private var instance: AccountHost? = null

    fun get(context: Context): AccountHost =
      instance ?: synchronized(this) {
        instance ?: AccountHost(context.applicationContext).also { instance = it }
      }
  }
}
