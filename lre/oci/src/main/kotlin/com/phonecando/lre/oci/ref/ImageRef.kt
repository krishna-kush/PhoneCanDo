package com.phonecando.lre.oci.ref

import com.phonecando.lre.api.LreException
/**
 * A parsed image reference: which registry, which repository, which tag or
 * digest. Build one with [parse] from what a person typed (`alpine`,
 * `kalilinux/kali-rolling`, `ghcr.io/owner/name:tag`, ...).
 */
data class ImageRef(
    /** Registry `host[:port]` we talk to; Docker Hub is [DOCKER_HUB]. */
    val registry: String,
    /** Repository path, e.g. `library/alpine` or `kalilinux/kali-rolling`. */
    val repository: String,
    /** Tag; `latest` when the input named neither tag nor digest. Null when only a digest was given. */
    val tag: String?,
    /** `sha256:<hex>` pinning the manifest; wins over [tag] when both are set. */
    val digest: String?,
) {
    init {
        require(tag != null || digest != null) { "an image reference needs a tag or a digest" }
    }

    /** What we ask the registry for: the digest when pinned, else the tag. */
    val reference: String get() = digest ?: tag!!

    /** True for Docker Hub, the only registry with our mirrors and the Hub catalog. */
    val isDockerHub: Boolean get() = registry == DOCKER_HUB

    /** Local registries (`localhost`, loopback) speak plain http, like Docker's default. */
    internal val scheme: String get() = if (isLoopback(registry)) "http" else "https"

    /** The same image pinned to [digest], e.g. a resolved manifest digest. */
    fun withDigest(digest: String): ImageRef = copy(digest = digest)

    /** Canonical form, e.g. `docker.io/library/alpine:3.22`. */
    override fun toString(): String = buildString {
        append(if (isDockerHub) "docker.io" else registry)
        append('/').append(repository)
        tag?.let { append(':').append(it) }
        digest?.let { append('@').append(it) }
    }

    companion object {
        /** The host Docker Hub's registry API answers on (`docker.io` is an alias). */
        const val DOCKER_HUB = "registry-1.docker.io"

        /**
         * Parses [input] the way `docker pull` does: a bare name is a Docker
         * Hub official image (`library/` prefix), a first path part with a
         * dot, a colon or `localhost` is a registry host, the tag defaults
         * to `latest`.
         *
         * @throws LreException.InvalidRef when [input] is not a reference.
         */
        fun parse(input: String): ImageRef = RefGrammar.parse(input)

        private fun isLoopback(registry: String): Boolean {
            val host = if (registry.startsWith("[")) {
                registry.substringBefore(']') + "]"
            } else {
                registry.substringBefore(':')
            }
            return host == "localhost" || host == "127.0.0.1" || host == "[::1]"
        }
    }
}
