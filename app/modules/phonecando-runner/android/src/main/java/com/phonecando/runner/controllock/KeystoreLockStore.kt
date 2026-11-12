package com.phonecando.runner.controllock

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
// app keeps; a plain saved "unlocked" or mode would let one unlock itself.
// So each record here is signed with its own Android Keystore key that
// signs only within AUTH_WINDOW_S of the user's fingerprint (strong
// biometrics) or screen-lock PIN, pattern or password, and the signature
// lives in prefs. Every save makes a new key, so an older copy of a record
// no longer checks out, and dropping the unlock deletes its key. A record
// whose key is missing was never ours (a fresh install, or prefs restored
// from a backup without the Keystore): the mode reads as DEFAULT, the
// unlock as absent. Checking a record uses the public key and needs no
// biometric.
internal class KeystoreLockStore(context: Context) : LockStore {
  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  override fun loadMode(): LockMode {
    if (!hasKey(MODE_ALIAS)) return LockMode.DEFAULT
    val wire = prefs.getString(KEY_MODE, null)
    val mode = LockMode.fromWire(wire) ?: return LockMode.STRICTEST
    return if (verify(MODE_ALIAS, MODE_MESSAGE + mode.wire, prefs.getString(KEY_MODE_SIG, null))) {
      mode
    } else {
      LockMode.STRICTEST
    }
  }

  override fun saveMode(mode: LockMode): Boolean {
    val sig = sign(MODE_ALIAS, MODE_MESSAGE + mode.wire) ?: return false
    return prefs.edit().putString(KEY_MODE, mode.wire).putString(KEY_MODE_SIG, sig).commit()
  }

  override fun hasSavedUnlock(): Boolean =
    hasKey(UNLOCK_ALIAS) && verify(UNLOCK_ALIAS, UNLOCK_MESSAGE, prefs.getString(KEY_UNLOCK_SIG, null))

  override fun saveUnlock(): Boolean {
    val sig = sign(UNLOCK_ALIAS, UNLOCK_MESSAGE) ?: return false
    return prefs.edit().putString(KEY_UNLOCK_SIG, sig).commit()
  }

  override fun dropUnlock() {
    prefs.edit().remove(KEY_UNLOCK_SIG).commit()
    try {
      keys().deleteEntry(UNLOCK_ALIAS)
    } catch (e: Exception) {
      Log.w(TAG, "could not delete the saved unlock's key", e)
    }
  }

  // A new key under [alias] (replacing the old one), then its signature of
  // [message]; null when the user has not just authenticated or the
  // Keystore refuses. Without a fresh authentication the old key and its
  // record stay as they were. A sign that fails after the new key replaced
  // the old one leaves a key whose record does not check out: the mode
  // reads as STRICTEST, the unlock as absent. Never deleting the key here
  // keeps a failure from reading as a fresh install's DEFAULT.
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

  private fun hasKey(alias: String): Boolean = try {
    keys().containsAlias(alias)
  } catch (e: Exception) {
    Log.w(TAG, "keystore unavailable", e)
    false
  }

  private fun keys(): KeyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }

  private companion object {
    const val TAG = "PhoneCanDoLock"
    const val PROVIDER = "AndroidKeyStore"
    const val ALGORITHM = "SHA256withECDSA"
    const val PREFS = "phonecando_phone_control"
    const val KEY_MODE = "mode"
    const val KEY_MODE_SIG = "mode_sig"
    const val KEY_UNLOCK_SIG = "unlock_sig"
    const val MODE_ALIAS = "phonecando_phone_control_mode"
    const val UNLOCK_ALIAS = "phonecando_phone_control_unlock"
    const val MODE_MESSAGE = "phonecando phone-control mode "
    const val UNLOCK_MESSAGE = "phonecando phone-control unlocked"

    /** Seconds after the user's biometric or PIN in which a key signs. */
    const val AUTH_WINDOW_S = 15
  }
}
