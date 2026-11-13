package com.phonecando.account.signin

import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import java.io.IOException

/** Why a sign-in ended without an account; `code` is what JS sees (SignInError in the TS shim). */
enum class SignInError(val code: String) {
  CANCELLED("cancelled"),
  UNAVAILABLE("unavailable"),
  NO_ACCOUNT("no_account"),
  NETWORK("network"),
  REJECTED("rejected"),
  NOT_CONFIGURED("not_configured"),
  FAILED("failed"),
}

/** A sign-in step that failed for a known reason. Its message never holds a token. */
class SignInException(val error: SignInError, message: String?) : Exception(message)

/** Maps what went wrong to a SignInError. Pure. */
object SignInErrors {
  /** A failure thrown by Google's account sheet or the network. */
  fun of(e: Throwable): SignInError = when (e) {
    is SignInException -> e.error
    is GetCredentialCancellationException -> SignInError.CANCELLED
    is NoCredentialException -> SignInError.NO_ACCOUNT
    // No credential provider on the phone: no (or too old) Google Play services.
    is GetCredentialProviderConfigurationException, is GetCredentialUnsupportedException -> SignInError.UNAVAILABLE
    is IOException -> SignInError.NETWORK
    else -> SignInError.FAILED
  }

  /** A non-200 answer from our accounts API; status 0 when none came. */
  fun ofAnswer(status: Int, errorCode: String?): SignInError = when {
    status == 0 -> SignInError.NETWORK
    status == 401 || status == 403 -> SignInError.REJECTED
    errorCode == "not_configured" -> SignInError.NOT_CONFIGURED
    else -> SignInError.FAILED
  }
}
