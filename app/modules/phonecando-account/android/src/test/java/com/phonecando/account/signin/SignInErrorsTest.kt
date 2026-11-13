package com.phonecando.account.signin

import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.NoCredentialException
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.IOException

class SignInErrorsTest {
  @Test
  fun sheetFailures() {
    assertEquals(SignInError.CANCELLED, SignInErrors.of(GetCredentialCancellationException("closed")))
    assertEquals(SignInError.NO_ACCOUNT, SignInErrors.of(NoCredentialException("none")))
    assertEquals(SignInError.UNAVAILABLE, SignInErrors.of(GetCredentialProviderConfigurationException("no gms")))
    assertEquals(SignInError.FAILED, SignInErrors.of(GetCredentialUnknownException("?")))
    assertEquals(SignInError.NETWORK, SignInErrors.of(IOException("down")))
    assertEquals(SignInError.NOT_CONFIGURED, SignInErrors.of(SignInException(SignInError.NOT_CONFIGURED, null)))
    assertEquals(SignInError.FAILED, SignInErrors.of(IllegalStateException()))
  }

  @Test
  fun serverAnswers() {
    assertEquals(SignInError.NETWORK, SignInErrors.ofAnswer(0, null))
    assertEquals(SignInError.REJECTED, SignInErrors.ofAnswer(401, "bad_token"))
    assertEquals(SignInError.REJECTED, SignInErrors.ofAnswer(403, null))
    assertEquals(SignInError.NOT_CONFIGURED, SignInErrors.ofAnswer(503, "not_configured"))
    assertEquals(SignInError.FAILED, SignInErrors.ofAnswer(429, "rate_limited"))
    assertEquals(SignInError.FAILED, SignInErrors.ofAnswer(500, "internal"))
  }

  @Test
  fun codesMatchTheShim() {
    assertEquals(
      listOf("cancelled", "unavailable", "no_account", "network", "rejected", "not_configured", "failed"),
      SignInError.entries.map { it.code },
    )
  }
}
