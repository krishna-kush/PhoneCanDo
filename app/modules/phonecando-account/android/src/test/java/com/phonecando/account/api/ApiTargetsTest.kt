package com.phonecando.account.api

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiTargetsTest {
  @Test
  fun ourApiHostIsAllowedInEveryBuild() {
    assertTrue(ApiTargets.baseAllowed("https://api.phonecando.app", debuggable = false))
    assertTrue(ApiTargets.baseAllowed("https://api.phonecando.app", debuggable = true))
  }

  @Test
  fun loopbackOnlyInDebugBuilds() {
    assertTrue(ApiTargets.baseAllowed("http://127.0.0.1:8787", debuggable = true))
    assertFalse(ApiTargets.baseAllowed("http://127.0.0.1:8787", debuggable = false))
  }

  @Test
  fun anyOtherHostIsRefused() {
    for (base in listOf(
      "https://api.phonecando.app/", "http://api.phonecando.app", "https://api.phonecando.app.evil.test",
      "https://phonecando.app", "http://localhost:8787", "http://127.0.0.1", "http://127.0.0.1:8787/x", "",
    )) {
      assertFalse(base, ApiTargets.baseAllowed(base, debuggable = true))
    }
  }

  @Test
  fun onlyAccountRoutes() {
    assertTrue(ApiTargets.pathAllowed("/v1/account"))
    assertTrue(ApiTargets.pathAllowed("/v1/account/shares"))
    assertTrue(ApiTargets.pathAllowed("/v1/account/delete"))
    for (path in listOf("/v1/accounts", "/v1/account/", "/v1/batch", "/v1/account/a/b", "/v1/account/../batch", "/v1/account?x=1", "")) {
      assertFalse(path, ApiTargets.pathAllowed(path))
    }
  }

  @Test
  fun methods() {
    assertTrue(ApiTargets.methodAllowed("PUT"))
    assertFalse(ApiTargets.methodAllowed("DELETE"))
    assertFalse(ApiTargets.methodAllowed("get"))
  }
}
