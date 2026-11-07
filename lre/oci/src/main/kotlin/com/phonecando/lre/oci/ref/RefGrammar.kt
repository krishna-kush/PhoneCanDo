package com.phonecando.lre.oci.ref

import com.phonecando.lre.api.LreException
/**
 * The reference grammar of the distribution spec (what `docker pull`
 * accepts), minus what we never pull: only `sha256` digests.
 */
internal object RefGrammar {
    private const val MAX_INPUT = 512
    private const val MAX_PATH = 255
    private val HUB_ALIASES = setOf("docker.io", "index.docker.io", ImageRef.DOCKER_HUB)

    private val COMPONENT = Regex("[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*")
    private val TAG = Regex("[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}")
    private val DIGEST = Regex("sha256:[a-f0-9]{64}")
    private val HOST = Regex(
        "(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*" +
            "|\\[[0-9A-Fa-f:.]+])(?::[0-9]{1,5})?",
    )

    fun parse(raw: String): ImageRef {
        val input = raw.trim()
        fun fail(reason: String): Nothing = throw LreException.InvalidRef(raw, reason)

        if (input.isEmpty()) fail("empty")
        if (input.length > MAX_INPUT) fail("too long")
        if (input.contains("://")) fail("write it without a scheme, like ghcr.io/owner/name")
        if (input.any { it.isWhitespace() }) fail("contains spaces")

        var rest = input
        var digest: String? = null
        val at = rest.indexOf('@')
        if (at >= 0) {
            digest = rest.substring(at + 1)
            rest = rest.substring(0, at)
            if (!DIGEST.matches(digest)) fail("a digest is sha256: and 64 lower-case hex characters")
        }

        var tag: String? = null
        val lastColon = rest.lastIndexOf(':')
        if (lastColon > rest.lastIndexOf('/')) {
            tag = rest.substring(lastColon + 1)
            rest = rest.substring(0, lastColon)
            if (!TAG.matches(tag)) fail("bad tag")
        }

        val slash = rest.indexOf('/')
        val first = if (slash > 0) rest.substring(0, slash) else null
        val hasHost = first != null &&
            (first.contains('.') || first.contains(':') || first == "localhost" || first.any { it.isUpperCase() })
        val host = if (hasHost) first!! else "docker.io"
        val path = if (hasHost) rest.substring(slash + 1) else rest

        if (hasHost && !HOST.matches(host)) fail("bad registry host")
        if (path.isEmpty()) fail("missing image name")
        if (path.length > MAX_PATH) fail("name too long")
        if (path.any { it.isUpperCase() }) fail("image names are lower-case")
        if (!path.split('/').all { COMPONENT.matches(it) }) fail("bad image name")

        val hub = host.lowercase() in HUB_ALIASES
        return ImageRef(
            registry = if (hub) ImageRef.DOCKER_HUB else host.lowercase(),
            repository = if (hub && !path.contains('/')) "library/$path" else path,
            tag = tag ?: if (digest == null) "latest" else null,
            digest = digest,
        )
    }
}
