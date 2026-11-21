package com.phonecando.runner.appaccess

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.UserNotAuthenticatedException
import android.util.Base64
import android.util.Log
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature

// Agents run as PhoneCanDo's Linux user, so they can write every file the
// app keeps; a plain saved "Always" or "Allow all" would let one let itself
// into any app. So, as with the phone-control lock
// (controllock/KeystoreLockStore), each of those is signed with its own
// Android Keystore key that signs only within AUTH_WINDOW_S of the user's
// fingerprint (strong biometrics) or screen-lock PIN, pattern or password,
// and the signature lives in prefs. Always is one key per app, so taking
// one app off (which needs no biometric) deletes its key and an older copy
// of its record never checks out again; Allow all is one key, deleted when
// it is turned off, and its record signs the No list with it. Every save
// makes a new key. A record whose key is missing or was not made this way
// does not count. "No" is plain prefs: a forged one only blocks more, and
// one taken off makes Allow all's record fail (everything asks again).
internal class KeystoreAppAccessStore(context: Context) : AppAccessStore {
  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  override fun loadAlways(): Set<String> =
    prefs.all.keys
      .filter { it.startsWith(ALWAYS_SIG) }
      .map { it.removePrefix(ALWAYS_SIG) }
      .filter { verify(alwaysAlias(it), ALWAYS_MESSAGE + it, prefs.getString(ALWAYS_SIG + it, null)) }
      .toSet()

  override fun saveAlways(pkg: String): Boolean {
    val sig = sign(alwaysAlias(pkg), ALWAYS_MESSAGE + pkg) ?: return false
    return prefs.edit().putString(ALWAYS_SIG + pkg, sig).commit()
  }

  override fun dropAlways(pkg: String) {
    prefs.edit().remove(ALWAYS_SIG + pkg).commit()
    deleteKey(alwaysAlias(pkg))
  }

  override fun loadAllowAll(blocked: Set<String>): Boolean =
    hasKey(ALL_ALIAS) && verify(ALL_ALIAS, allMessage(blocked), prefs.getString(KEY_ALL_SIG, null))

  override fun saveAllowAll(blocked: Set<String>): Boolean {
    val sig = sign(ALL_ALIAS, allMessage(blocked)) ?: return false
    return prefs.edit().putString(KEY_ALL_SIG, sig).commit()
  }

  override fun dropAllowAll() {
    prefs.edit().remove(KEY_ALL_SIG).commit()
    deleteKey(ALL_ALIAS)
  }

  override fun loadBlocked(): Set<String> = prefs.getStringSet(KEY_BLOCKED, null)?.toSet() ?: emptySet()

  override fun saveBlocked(packages: Set<String>) {
    prefs.edit().putStringSet(KEY_BLOCKED, HashSet(packages)).commit()
  }

  // A new key under [alias] (replacing the old one), then its signature of
  // [message]; null when the user has not just authenticated or the
  // Keystore refuses. Without a fresh authentication the old key and its
  // record stay as they were; a sign that fails after the new key replaced
  // the old one leaves a record that does not check out, which only asks
  // more.
  private fun sign(alias: String, message: String): String? {
    if (!justAuthenticated(alias)) return null
    return try {
      val pair = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVIDER)
        .apply { initialize(spec(alias)) }
        .generateKeyPair()
      val sig = Signature.getInstance(ALGORITHM).run {
        initSign(pair.private)
        update(message.toByteArray())
        sign()
      }
      Base64.encodeToString(sig, Base64.NO_WRAP)
    } catch (e: Exception) {
      Log.w(TAG, "could not sign $alias", e)
      null
    }
  }

  // The old key under [alias] would sign now. Only "the user has not just
  // authenticated" says no: a missing key, or one Android voided when the
  // screen lock was removed, has nothing worth keeping.
  private fun justAuthenticated(alias: String): Boolean = try {
    val key = keys().getKey(alias, null) as? PrivateKey
    key?.let { Signature.getInstance(ALGORITHM).initSign(it) }
    true
  } catch (_: UserNotAuthenticatedException) {
    false
  } catch (_: Exception) {
    true
  }

  private fun verify(alias: String, message: String, sig: String?): Boolean {
    if (sig == null) return false
    return try {
      val entry = keys().getEntry(alias, null) as? KeyStore.PrivateKeyEntry ?: return false
      if (!authBound(entry.privateKey)) return false
      Signature.getInstance(ALGORITHM).run {
        initVerify(entry.certificate.publicKey)
        update(message.toByteArray())
        verify(Base64.decode(sig, Base64.NO_WRAP))
      }
    } catch (e: Exception) {
      Log.w(TAG, "could not check $alias", e)
      false
    }
  }

  // A key we made: it signs only right after the user's biometric or PIN.
  // A key made any other way under our alias does not count.
  private fun authBound(key: PrivateKey): Boolean {
    val info = KeyFactory.getInstance(key.algorithm, PROVIDER).getKeySpec(key, KeyInfo::class.java)
    @Suppress("DEPRECATION")
    val window = info.userAuthenticationValidityDurationSeconds
    return info.isUserAuthenticationRequired && window in 1..AUTH_WINDOW_S
  }

  private fun spec(alias: String): KeyGenParameterSpec =
    KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
      .setDigests(KeyProperties.DIGEST_SHA256)
      .setUserAuthenticationRequired(true)
      .apply {
        if (Build.VERSION.SDK_INT >= 30) {
          setUserAuthenticationParameters(
            AUTH_WINDOW_S,
            KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL,
          )
        } else {
          @Suppress("DEPRECATION")
          setUserAuthenticationValidityDurationSeconds(AUTH_WINDOW_S)
        }
      }
      .build()

  private fun deleteKey(alias: String) {
    try {
      val store = keys()
      if (store.containsAlias(alias)) store.deleteEntry(alias)
    } catch (e: Exception) {
      Log.w(TAG, "could not delete $alias", e)
    }
  }

  private fun hasKey(alias: String): Boolean = try {
    keys().containsAlias(alias)
  } catch (e: Exception) {
    Log.w(TAG, "keystore unavailable", e)
    false
  }

  private fun keys(): KeyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }

  private fun alwaysAlias(pkg: String) = ALWAYS_ALIAS + pkg

  // A package name has no comma, so the sorted list reads one way only.
  private fun allMessage(blocked: Set<String>) = ALL_MESSAGE + blocked.sorted().joinToString(",")

  private companion object {
    const val TAG = "PhoneCanDoAppAccess"
    const val PROVIDER = "AndroidKeyStore"
    const val ALGORITHM = "SHA256withECDSA"
    const val PREFS = "phonecando_app_access"
    const val ALWAYS_SIG = "always_sig:"
    const val KEY_ALL_SIG = "allow_all_sig"
    const val KEY_BLOCKED = "blocked"
    const val ALWAYS_ALIAS = "phonecando_app_access_always_"
    const val ALL_ALIAS = "phonecando_app_access_allow_all"
    const val ALWAYS_MESSAGE = "phonecando app-access always "
    const val ALL_MESSAGE = "phonecando app-access allowAll v1 "

    /** Seconds after the user's biometric or PIN in which a key signs. */
    const val AUTH_WINDOW_S = 15
  }
}
