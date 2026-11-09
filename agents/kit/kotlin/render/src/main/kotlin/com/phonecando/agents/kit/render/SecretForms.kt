package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.Auth
import java.util.Base64

// The forms an engine password takes on the wire, from the manifest's
// `engine.auth`: the raw value (OPENCODE_SERVER_PASSWORD and the like) and,
// with `basic`, its HTTP Basic credential. Redaction replaces every one.
object SecretForms {
  /** base64("user:password"), the value after "Basic ". */
  fun basicCredential(user: String, password: String): String =
    Base64.getEncoder().encodeToString("$user:$password".toByteArray(Charsets.UTF_8))

  fun of(auth: Auth?, password: String): List<String> =
    listOfNotNull(password, auth?.basic?.let { basicCredential(it.user, password) })

  /** The headers every request to the engine carries. */
  fun headers(auth: Auth?, password: String): Map<String, String> =
    auth?.basic?.let { mapOf("Authorization" to "Basic ${basicCredential(it.user, password)}") } ?: emptyMap()
}
