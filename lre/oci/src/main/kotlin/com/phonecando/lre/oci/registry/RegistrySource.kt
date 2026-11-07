package com.phonecando.lre.oci.registry

/**
 * One place an image can be pulled from: the image's own registry
 * ([primary]) or a mirror with its own repository path.
 */
internal data class RegistrySource(
    val scheme: String,
    val host: String,
    val repository: String,
    val primary: Boolean,
) {
    /** `<scheme>://<host>/v2/<repository>/<path>`, e.g. path `manifests/latest`. */
    fun url(path: String): String = "$scheme://$host/v2/$repository/$path"

    /** Tokens are scoped to one repository on one registry. */
    val tokenKey: String get() = "$host/$repository"
}
