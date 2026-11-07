package com.phonecando.linux.registry

import com.phonecando.lre.oci.ref.ImageRef

/**
 * What createRegistryEnv's {image, tag} name. A blank tag keeps the
 * image's own (or `latest`), a `sha256:` tag pins a digest. Pure.
 */
object RegistryRef {
  /** @throws com.phonecando.lre.api.LreException.InvalidRef when it is not a reference. */
  fun parse(image: String, tag: String): ImageRef {
    val name = image.trim()
    val t = tag.trim()
    val input = when {
      t.isEmpty() -> name
      t.startsWith("sha256:") -> "$name@$t"
      else -> "$name:$t"
    }
    return ImageRef.parse(input)
  }

  /** The env's display name: what the user picked, e.g. `alpine:3.22`. */
  fun displayName(image: String, tag: String): String {
    val name = image.trim()
    val t = tag.trim()
    return when {
      t.isEmpty() -> name
      t.startsWith("sha256:") -> "$name@${t.take(SHORT_DIGEST)}"
      else -> "$name:$t"
    }
  }

  // `sha256:` and 12 hex characters, as docker prints short ids.
  private const val SHORT_DIGEST = 19
}
