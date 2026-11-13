package com.phonecando.account.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AccountWireTest {
  private val token = "A".repeat(43)

  @Test
  fun readsTheNonce() {
    assertEquals("n0nce-n0nce_n0nce", AccountWire.nonce("""{"nonce":"n0nce-n0nce_n0nce"}"""))
    assertNull(AccountWire.nonce("""{"nonce":"short"}"""))
    assertNull(AccountWire.nonce("""{"nonce":"has space in it, so no"}"""))
    assertNull(AccountWire.nonce("not json"))
  }

  @Test
  fun readsASignIn() {
    val signed = AccountWire.signedIn("""{"token":"$token","account":{"email":"a@b.c","createdAt":5}}""")!!
    assertEquals(token, signed.token)
    val account = JSONObject(signed.accountJson)
    assertEquals("a@b.c", account.getString("email"))
    assertEquals(5L, account.getLong("createdAt"))
  }

  @Test
  fun refusesAnotherShape() {
    assertNull(AccountWire.signedIn("""{"token":"$token"}"""))
    assertNull(AccountWire.signedIn("""{"token":"$token","account":{}}"""))
    assertNull(AccountWire.signedIn("""{"token":"bad token","account":{"email":"a@b.c"}}"""))
    assertNull(AccountWire.signedIn("""[]"""))
  }

  @Test
  fun readsTheErrorCode() {
    assertEquals("not_configured", AccountWire.errorCode("""{"error":"not_configured"}"""))
    assertNull(AccountWire.errorCode("""{"ok":true}"""))
    assertNull(AccountWire.errorCode(""))
  }

  @Test
  fun writesTheSignInBody() {
    val body = JSONObject(AccountWire.signInBody("id.token", "nonce"))
    assertEquals("id.token", body.getString("idToken"))
    assertEquals("nonce", body.getString("nonce"))
  }
}
