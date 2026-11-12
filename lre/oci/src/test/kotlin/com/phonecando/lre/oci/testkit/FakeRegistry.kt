package com.phonecando.lre.oci.testkit

import com.phonecando.network.http.HttpResponse
import com.phonecando.network.testkit.FakePort
import com.phonecando.network.testkit.Request
import com.phonecando.network.testkit.reply

/**
 * One repository on a fake registry, installed into a [FakePort]:
 * anonymous Bearer auth (when [auth] is set), manifests by tag and digest,
 * blobs redirected to a CDN that serves `Range` and refuses credentials.
 */
class FakeRegistry(
    private val port: FakePort,
    val host: String,
    val repository: String,
    private val auth: Auth? = Auth.DOCKER_HUB,
) {
    /** Where tokens come from; [scope] null means the registry asks for `repository:<repo>:pull`. */
    data class Auth(val realm: String, val service: String, val scope: String? = null) {
        companion object {
            val DOCKER_HUB = Auth("https://auth.docker.io/token", "registry.docker.io")
            val ECR = Auth("https://public.ecr.aws/token/", "public.ecr.aws", scope = "aws")
        }
    }

    /** The token this registry hands out; it must never show up in an error. */
    val token = "SECRET-token-of-$host"
    val base = "https://$host/v2/$repository/"
    val cdn = "https://cdn.$host.test/"

    var tokenFetches = 0
        private set
    var unauthorized = 0
        private set

    /** The CDN answers 200 with the whole blob whatever `Range` says. */
    var ignoreRange = false

    /** Blobs come straight from the registry instead of a CDN redirect. */
    var redirectBlobs = true

    /** When it returns a response, that answers the registry request instead (CDN excluded). */
    var outage: (Request) -> HttpResponse? = { null }

    /** When it returns a response, that answers the CDN request instead. */
    var cdnOutage: (Request) -> HttpResponse? = { null }

    private val manifests = HashMap<String, Pair<ByteArray, String>>()
    private val blobs = HashMap<String, ByteArray>()

    init {
        port.onPrefix(base) { handle(it) }
        port.onPrefix(cdn) { fromCdn(it) }
        auth?.let { a ->
            port.onPrefix(a.realm) { request ->
                tokenFetches++
                check(request.header("Authorization") == null) { "credentials sent to the token realm" }
                reply(200, """{"token":"$token","expires_in":300,"issued_at":"2026-11-07T00:00:00Z"}""")
            }
        }
    }

    /** Serves [bytes] by digest and, when given, by [tag]. Returns the digest. */
    fun manifest(tag: String?, bytes: ByteArray, contentType: String): String {
        val digest = Fixtures.sha256(bytes)
        manifests[digest] = bytes to contentType
        tag?.let { manifests[it] = bytes to contentType }
        return digest
    }

    fun manifestFixture(tag: String?, path: String, contentType: String): String =
        manifest(tag, Fixtures.bytes(path), contentType)

    /** Serves [bytes] as blob [digest] (pass a wrong digest to tamper). */
    fun blob(bytes: ByteArray, digest: String = Fixtures.sha256(bytes)): String {
        blobs[digest] = bytes
        return digest
    }

    private fun handle(request: Request): HttpResponse {
        outage(request)?.let { return it }
        if (auth != null && request.header("Authorization") != "Bearer $token") {
            unauthorized++
            val scope = auth.scope ?: "repository:$repository:pull"
            return reply(
                401,
                Fixtures.bytes("registry/unauthorized.json"),
                mapOf("WWW-Authenticate" to """Bearer realm="${auth.realm}",service="${auth.service}",scope="$scope""""),
            )
        }
        val path = request.url.removePrefix(base)
        return when {
            path.startsWith("manifests/") -> {
                val (bytes, type) = manifests[path.removePrefix("manifests/")] ?: return notFound()
                reply(200, bytes, mapOf("Content-Type" to type, "Docker-Content-Digest" to Fixtures.sha256(bytes)))
            }
            path.startsWith("blobs/") -> {
                val digest = path.removePrefix("blobs/")
                val bytes = blobs[digest] ?: return notFound()
                if (redirectBlobs) {
                    reply(307, ByteArray(0), mapOf("Location" to "$cdn${digest.replace(':', '/')}?X-Amz-Signature=SIGNED"))
                } else {
                    ranged(request, bytes)
                }
            }
            else -> notFound()
        }
    }

    private fun fromCdn(request: Request): HttpResponse {
        if (request.header("Authorization") != null) return reply(400, "credentials leaked to the CDN")
        cdnOutage(request)?.let { return it }
        val digest = request.url.removePrefix(cdn).substringBefore('?').replace('/', ':')
        return ranged(request, blobs[digest] ?: return notFound())
    }

    private fun ranged(request: Request, bytes: ByteArray): HttpResponse {
        val range = request.header("Range")
        if (range == null || ignoreRange) return reply(200, bytes, mapOf("Content-Length" to bytes.size.toString()))
        val start = range.removePrefix("bytes=").substringBefore('-').toInt()
        if (start >= bytes.size) return reply(416, ByteArray(0), mapOf("Content-Range" to "bytes */${bytes.size}"))
        return reply(
            206,
            bytes.copyOfRange(start, bytes.size),
            mapOf("Content-Range" to "bytes $start-${bytes.size - 1}/${bytes.size}"),
        )
    }

    private fun notFound() = reply(404, """{"errors":[{"code":"MANIFEST_UNKNOWN"}]}""")
}
