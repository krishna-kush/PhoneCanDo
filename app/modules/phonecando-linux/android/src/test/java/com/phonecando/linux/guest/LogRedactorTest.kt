package com.phonecando.linux.guest

import org.junit.Assert.assertEquals
import org.junit.Test

// JVM checks for what the install log and its tail never show.
class LogRedactorTest {
  private fun r(line: String) = LogRedactor.redact(line)

  @Test fun urlUserInfoGoesTheHostStays() {
    assertEquals("fetch https://<secret>@registry.example.com/pkg", r("fetch https://bob:hunter22@registry.example.com/pkg"))
    assertEquals("Get:1 http://deb.debian.org/debian trixie InRelease", r("Get:1 http://deb.debian.org/debian trixie InRelease"))
  }

  @Test fun headerCredentialsKeepLabelAndScheme() {
    assertEquals("Authorization: Bearer <secret>", r("Authorization: Bearer abc.def.ghi"))
    assertEquals("x-api-key=<secret>", r("x-api-key=abcdef123456"))
    assertEquals("curl -H 'Authorization: Basic <secret>'", r("curl -H 'Authorization: Basic dXNlcjpwYXNzd29yZA=='"))
    assertEquals("curl -H 'x-api-key: Bearer <secret>'", r("curl -H 'x-api-key: Bearer zzzzzzzzzz'"))
  }

  @Test fun secretNamedPairsLoseTheirValue() {
    assertEquals("NPM_TOKEN=<secret> npm i", r("NPM_TOKEN=abc123 npm i"))
    assertEquals("GET /cb?code=1&access_token=<secret>&x=2", r("GET /cb?code=1&access_token=zzz&x=2"))
    assertEquals("{\"password\": \"<secret>\"}", r("{\"password\": \"pa55\"}"))
    assertEquals("//registry.npmjs.org/:_authToken=<secret>", r("//registry.npmjs.org/:_authToken=npm_secretvalue"))
  }

  @Test fun packageNamesThatLookLikeKeywordsStay() {
    assertEquals("Setting up passwd:arm64 (1:4.17.4-2) ...", r("Setting up passwd:arm64 (1:4.17.4-2) ..."))
    assertEquals("Unpacking passwd (1:4.17.4-2) ...", r("Unpacking passwd (1:4.17.4-2) ..."))
  }

  @Test fun providerKeyShapesGo() {
    assertEquals("key <secret> set", r("key sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUV set"))
    assertEquals("<secret>", r("ghp_abcdefghijklmnopqrstuvwxyz0123"))
  }

  @Test fun redactingTwiceChangesNothing() {
    listOf(
      "Authorization: Bearer abc.def.ghi",
      "NPM_TOKEN=abc123",
      "https://u:p@h/x",
      "curl -H 'x-api-key: Bearer zzzzzzzzzz'",
    ).forEach { line -> assertEquals(line, r(line), r(r(line))) }
  }
}
