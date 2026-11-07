package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.testkit.FakeRegistry
import com.phonecando.lre.oci.testkit.FakeTransport
import com.phonecando.lre.oci.testkit.Fixtures
import com.phonecando.lre.oci.testkit.Synthetic
import com.phonecando.lre.oci.testkit.reply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals

class ResolveTest {
    private val fake = FakeTransport()
    private val client = RegistryClient(fake, Mirrors.NONE, RetryPolicy(sleeper = {}))

    private fun alpine() = FakeRegistry(fake, ImageRef.DOCKER_HUB, "library/alpine").apply {
        manifestFixture("latest", "registry/alpine-index.json", Fixtures.OCI_INDEX)
        manifestFixture(null, "registry/alpine-arm64-manifest.json", Fixtures.OCI_MANIFEST)
        blob(Fixtures.bytes("registry/alpine-arm64-config.json"))
    }

    private fun kali() = FakeRegistry(fake, ImageRef.DOCKER_HUB, "kalilinux/kali-rolling").apply {
        manifestFixture("latest", "registry/kali-latest-list.json", Fixtures.DOCKER_LIST)
        manifestFixture("arm64", "registry/kali-arm64-manifest.json", Fixtures.DOCKER_MANIFEST)
        manifestFixture("amd64", "registry/kali-amd64-manifest.json", Fixtures.DOCKER_MANIFEST)
        blob(Fixtures.bytes("registry/kali-arm64-config.json"))
        blob(Fixtures.bytes("registry/kali-amd64-config.json"))
    }

    @Test
    fun `an OCI index resolves to its linux arm64 v8 manifest`() {
        alpine()
        val resolved = client.resolve(ImageRef.parse("alpine:latest"))

        assertEquals(Fixtures.ALPINE_ARM64, resolved.manifestDigest)
        assertEquals(ImageRef.DOCKER_HUB, resolved.sourceHost)
        assertEquals(
            ImageConfig(
                env = listOf("PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"),
                workingDir = "/",
                user = null,
                entrypoint = emptyList(),
                cmd = listOf("/bin/sh"),
            ),
            resolved.config,
        )
        assertEquals(
            listOf(LayerDescriptor(Fixtures.ALPINE_ARM64_LAYER, 4190595, "application/vnd.oci.image.layer.v1.tar+gzip", Compression.GZIP)),
            resolved.layers,
        )
        assertEquals(4190595, resolved.downloadSize)
        val asked = fake.requestsTo("https://registry-1.docker.io/v2/library/alpine/manifests/").map { it.url.substringAfterLast('/') }
        assertEquals(listOf("latest", "latest", Fixtures.ALPINE_ARM64), asked) // first try was the 401
    }

    @Test
    fun `a Docker manifest list picks arm64 without a variant`() {
        kali()
        val resolved = client.resolve(ImageRef.parse("kalilinux/kali-rolling"))
        assertEquals(Fixtures.KALI_ARM64, resolved.manifestDigest)
        assertEquals(listOf("bash"), resolved.config.cmd)
        assertEquals(listOf("PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "LANG=C.UTF-8"), resolved.config.env)
        val layer = resolved.layers.single()
        assertEquals("application/vnd.docker.image.rootfs.diff.tar.gzip", layer.mediaType)
        assertEquals(Compression.GZIP, layer.compression)
        assertEquals(52340528, layer.size)
    }

    @Test
    fun `a single-arch arm64 manifest resolves directly`() {
        kali()
        val resolved = client.resolve(ImageRef.parse("kalilinux/kali-rolling:arm64"))
        assertEquals(Fixtures.KALI_ARM64, resolved.manifestDigest)
    }

    @Test
    fun `pinning the resolved digest gets the same layers`() {
        alpine()
        val first = client.resolve(ImageRef.parse("alpine"))
        val again = client.resolve(first.ref.withDigest(first.manifestDigest))
        assertEquals(first.layers, again.layers)
        assertEquals(first.manifestDigest, again.manifestDigest)
    }

    @Test
    fun `x86-only images are NoArm64`() {
        kali()
        assertThrows<LreException.NoArm64> { client.resolve(ImageRef.parse("kalilinux/kali-rolling:amd64")) }

        FakeRegistry(fake, ImageRef.DOCKER_HUB, "library/archlinux")
            .manifestFixture("latest", "registry/archlinux-index.json", Fixtures.OCI_INDEX)
        val e = assertThrows<LreException.NoArm64> { client.resolve(ImageRef.parse("archlinux")) }
        assertEquals("docker.io/library/archlinux:latest", e.image)
    }

    @Test
    fun `a config without an arm64 architecture is NoArm64 for single-arch manifests`() {
        val registry = FakeRegistry(fake, "ghcr.io", "owner/tool", auth = null)
        val config = Synthetic.config(architecture = "amd64")
        registry.blob(config)
        registry.manifest("1", Synthetic.manifest(config, emptyList()), Fixtures.OCI_MANIFEST)
        assertThrows<LreException.NoArm64> { client.resolve(ImageRef.parse("ghcr.io/owner/tool:1")) }
    }

    @Test
    fun `config fields map, empty strings meaning unset`() {
        val registry = FakeRegistry(fake, "ghcr.io", "owner/app", auth = null)
        val config = Synthetic.config(
            runtime = """{"Env":["A=1","B=2"],"WorkingDir":"","User":"1000:1000","Entrypoint":["/init","--"],"Cmd":null,"Labels":{"x":"y"}}""",
        )
        registry.blob(config)
        registry.manifest("v1", Synthetic.manifest(config, emptyList()), Fixtures.OCI_MANIFEST)
        assertEquals(
            ImageConfig(listOf("A=1", "B=2"), workingDir = null, user = "1000:1000", entrypoint = listOf("/init", "--"), cmd = emptyList()),
            client.resolve(ImageRef.parse("ghcr.io/owner/app:v1")).config,
        )
    }

    @Test
    fun `layer media types, zstd marked, foreign refused`() {
        val registry = FakeRegistry(fake, "quay.io", "x/y", auth = null)
        val config = Synthetic.config()
        registry.blob(config)
        val digest = "sha256:" + "cd".repeat(32)
        registry.manifest(
            "mixed",
            Synthetic.manifest(
                config,
                listOf(
                    Synthetic.Layer("application/vnd.oci.image.layer.v1.tar", digest, 10),
                    Synthetic.Layer("application/vnd.oci.image.layer.v1.tar+gzip", digest, 11),
                    Synthetic.Layer("application/vnd.oci.image.layer.v1.tar+zstd", digest, 12),
                ),
            ),
            Fixtures.OCI_MANIFEST,
        )
        registry.manifest(
            "foreign",
            Synthetic.manifest(
                config,
                listOf(Synthetic.Layer("application/vnd.docker.image.rootfs.foreign.diff.tar.gzip", digest, 1, ""","urls":["https://example.test/l"]""")),
                Fixtures.DOCKER_MANIFEST,
            ),
            Fixtures.DOCKER_MANIFEST,
        )
        val layers = client.resolve(ImageRef.parse("quay.io/x/y:mixed")).layers
        assertEquals(listOf(Compression.NONE, Compression.GZIP, Compression.ZSTD), layers.map { it.compression })

        val e = assertThrows<LreException.UnsupportedLayer> { client.resolve(ImageRef.parse("quay.io/x/y:foreign")) }
        assertEquals("application/vnd.docker.image.rootfs.foreign.diff.tar.gzip", e.mediaType)
    }

    @Test
    fun `a manifest that does not match its pinned digest is refused`() {
        val registry = alpine()
        val other = "sha256:" + "ef".repeat(32)
        registry.manifest(other, Fixtures.bytes("registry/alpine-arm64-manifest.json"), Fixtures.OCI_MANIFEST)
        assertThrows<LreException.DigestMismatch> { client.resolve(ImageRef.parse("alpine@$other")) }
    }

    @Test
    fun `a manifest that does not match the registry's digest header is refused`() {
        val registry = FakeRegistry(fake, "ghcr.io", "a/b", auth = null)
        registry.outage = { request ->
            if (request.url.endsWith("/manifests/latest")) {
                reply(200, Fixtures.bytes("registry/kali-arm64-manifest.json"), mapOf("Content-Type" to Fixtures.DOCKER_MANIFEST, "Docker-Content-Digest" to Fixtures.KALI_AMD64))
            } else {
                null
            }
        }
        assertThrows<LreException.DigestMismatch> { client.resolve(ImageRef.parse("ghcr.io/a/b")) }
    }

    @Test
    fun `a tampered config blob is refused`() {
        val registry = FakeRegistry(fake, ImageRef.DOCKER_HUB, "library/alpine")
        registry.manifestFixture("latest", "registry/alpine-arm64-manifest.json", Fixtures.OCI_MANIFEST)
        registry.blob("""{"architecture":"arm64","os":"linux"}""".toByteArray(), digest = Fixtures.ALPINE_ARM64_CONFIG)
        assertThrows<LreException.DigestMismatch> { client.resolve(ImageRef.parse("alpine")) }
    }

    @Test
    fun `garbage manifests are Corrupt, schema 1 unsupported, missing tags NotFound`() {
        val registry = FakeRegistry(fake, "ghcr.io", "a/b", auth = null)
        registry.manifest("junk", "not json".toByteArray(), Fixtures.OCI_MANIFEST)
        registry.manifest("v1", """{"schemaVersion":1,"fsLayers":[]}""".toByteArray(), "application/vnd.docker.distribution.manifest.v1+prettyjws")
        assertThrows<LreException.Corrupt> { client.resolve(ImageRef.parse("ghcr.io/a/b:junk")) }
        assertThrows<LreException.UnsupportedManifest> { client.resolve(ImageRef.parse("ghcr.io/a/b:v1")) }
        assertThrows<LreException.NotFound> { client.resolve(ImageRef.parse("ghcr.io/a/b:nope")) }
    }
}
