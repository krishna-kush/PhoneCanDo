package com.phonecando.account.api

import org.json.JSONException
import org.json.JSONObject

/** A /v1/account/signin answer: the session token and the account, as the server's JSON. */
data class SignedIn(val token: String, val accountJson: String)

/**
 * The accounts API's JSON as the sign-in flow reads and writes it
 * (spec: accounts routes). Every reader answers null for a body that is not
 * the expected shape; nothing here throws.
 */
object AccountWire {
  // base64url of 32 random bytes is 43 chars; the bounds only refuse junk.
  private val TOKEN = Regex("^[A-Za-z0-9_-]{16,512}$")
  private val NONCE = Regex("^[A-Za-z0-9_-]{16,512}$")

  /** The nonce of a /v1/account/nonce answer. */
  fun nonce(body: String): String? =
    obj(body)?.optString("nonce", "")?.takeIf { NONCE.matches(it) }

  fun signedIn(body: String): SignedIn? {
    val o = obj(body) ?: return null
    val token = o.optString("token", "").takeIf { TOKEN.matches(it) } ?: return null
    val account = o.optJSONObject("account") ?: return null
    if (account.optString("email", "").isEmpty()) return null
    return SignedIn(token, account.toString())
  }

  /** The `error` code of an error answer ({ "error": code }). */
  fun errorCode(body: String): String? = obj(body)?.optString("error", "")?.ifEmpty { null }

  fun signInBody(idToken: String, nonce: String): String =
    JSONObject().put("idToken", idToken).put("nonce", nonce).toString()

  private fun obj(body: String): JSONObject? = try {
    JSONObject(body)
  } catch (_: JSONException) {
    null
  }
}
