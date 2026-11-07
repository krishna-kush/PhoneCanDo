package com.phonecando.lre.oci.catalog

import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.testkit.FakeTransport
import com.phonecando.lre.oci.testkit.Fixtures
import com.phonecando.lre.oci.testkit.reply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class HubCatalogTest {
    private val fake = FakeTransport()
    private val catalog = HubCatalog(fake)
    private val alpineTags = "https://hub.docker.com/v2/namespaces/library/repositories/alpine/tags"

    @Test
    fun `official operating systems come from the Hub search`() {
        fake.on(HubCatalog.SEARCH_URL, { reply(200, Fixtures.bytes("catalog/search-v4-os-arm64.json")) })
        val images = catalog.officialOperatingSystems()

        assertEquals(
            listOf(
                "busybox", "alpine", "ubuntu", "debian", "amazonlinux", "fedora", "oraclelinux",
                "rockylinux", "ros", "photon", "almalinux", "cirros", "mageia", "alt",
            ),
            images.map { it.name },
        )
        val alpine = images[1]
        assertEquals(12474594457, alpine.pullCount)
        assertTrue(alpine.description.startsWith("A minimal Docker image based on Alpine Linux"))
        assertEquals("https://djeqr6to3dedg.cloudfront.net/repo-logos/library/alpine/live/logo-1788588737954.png", alpine.logoUrl)
        assertEquals(1, fake.requests.size)
    }

    @Test
    fun `the search result is filtered on our side too`() {
        fun result(
            name: String,
            badge: String = "official",
            arch: String = "arm64",
            description: String = "$name os",
            archived: Boolean = false,
            category: String = "operating-systems",
        ) = """{"id":"library/$name","name":"$name","badge":"$badge","short_description":"$description",""" +
            """"archived":$archived,"architectures":[{"name":"$arch"}],"categories":[{"slug":"$category"}]}"""
        val body = """{"total":7,"results":[
            ${result("keep")},
            ${result("x86", arch = "amd64")},
            ${result("old", description = "DEPRECATED; use keep")},
            ${result("gone", archived = true)},
            ${result("community", badge = "verified_publisher")},
            ${result("webserver", category = "web-servers")},
            {"id":"acme/os","name":"os","badge":"official","architectures":[],"categories":[{"slug":"operating-systems"}],"logo_url":{"small":"http://insecure.test/l.png"}}
        ]}"""
        fake.on(HubCatalog.SEARCH_URL, { reply(200, body) })
        val images = catalog.officialOperatingSystems()
        assertEquals(listOf("keep", "acme/os"), images.map { it.name })
        assertNull(images[1].logoUrl)
    }

    @Test
    fun `a failing search falls back to the documented listing`() {
        fake.on(HubCatalog.SEARCH_URL, { reply(500, "") })
        fake.on(HubCatalog.REPOSITORIES_URL, { reply(200, Fixtures.bytes("catalog/library-repos-by-pulls.json")) })
        val images = catalog.officialOperatingSystems()
        assertEquals(
            listOf("busybox", "alpine", "ubuntu", "debian", "amazonlinux", "fedora", "rockylinux", "oraclelinux", "ros", "archlinux"),
            images.map { it.name },
        )
        assertTrue(images.all { it.logoUrl == null })
        assertEquals(12481360419, images[1].pullCount)
    }

    @Test
    fun `an empty search falls back, and when both fail the search error wins`() {
        fake.on(HubCatalog.SEARCH_URL, { reply(200, """{"total":0,"results":[]}""") })
        fake.on(HubCatalog.REPOSITORIES_URL, { reply(200, Fixtures.bytes("catalog/library-repos-by-pulls.json")) })
        assertEquals("busybox", catalog.officialOperatingSystems().first().name)

        fake.on(HubCatalog.SEARCH_URL, { reply(429, "") })
        fake.on(HubCatalog.REPOSITORIES_URL, { reply(503, "") })
        assertThrows<LreException.RateLimited> { catalog.officialOperatingSystems() }
    }

    @Test
    fun `tags keep arm64 images only, common tags first`() {
        fake.on("$alpineTags?page=1&page_size=100", { reply(200, Fixtures.bytes("catalog/tags-alpine.json")) })
        val page = catalog.tags("alpine")

        assertEquals(
            listOf(
                "latest", "3", "3.24", "3.24.4", "3.24.3", "3.24.2", "3.24.1", "3.24.0",
                "3.23", "3.23.8", "3.23.7", "3.23.6", "3.23.5",
                "3.22", "3.22.8", "3.22.7", "3.22.6", "3.22.5", "3.22.4",
                "3.21", "3.21.10", "3.21.9", "3.21.8",
                "edge", "20260805",
            ),
            page.tags.map { it.name },
        )
        val latest = page.tags.first()
        assertEquals(4190595, latest.sizeArm64)
        assertEquals(Fixtures.ALPINE_ARM64, latest.digest)
        assertEquals("2026-11-05T23:24:49.125894Z", latest.lastUpdated)
        assertEquals(2, page.next)
    }

    @Test
    fun `non-library repositories work and drop x86-only tags`() {
        val url = "https://hub.docker.com/v2/namespaces/kalilinux/repositories/kali-rolling/tags?page=1&page_size=100"
        fake.on(url, { reply(200, Fixtures.bytes("catalog/tags-kali-rolling.json")) })
        val page = catalog.tags("kalilinux/kali-rolling")
        assertEquals(listOf("latest", "arm64"), page.tags.map { it.name })
        assertTrue(page.tags.all { it.digest == Fixtures.KALI_ARM64 })
        assertNull(page.next)
    }

    @Test
    fun `search and paging go into the url`() {
        fake.on("$alpineTags?page=3&page_size=100&name=3.2+rc%2F1", { reply(200, """{"count":0,"next":null,"results":[]}""") })
        val page = catalog.tags("library/alpine", page = 3, query = " 3.2 rc/1 ")
        assertTrue(page.tags.isEmpty())
        assertNull(page.next)
    }

    @Test
    fun `typed errors`() {
        fake.on("https://hub.docker.com/v2/namespaces/library/repositories/nope/tags?page=1&page_size=100", { reply(404, "{}") })
        fake.on("$alpineTags?page=1&page_size=100", { reply(429, "") }, { reply(200, "<html>") })
        assertThrows<LreException.NotFound> { catalog.tags("nope") }
        assertThrows<LreException.RateLimited> { catalog.tags("alpine") }
        assertThrows<LreException.Corrupt> { catalog.tags("alpine") }
        assertThrows<LreException.NotFound> { catalog.tags("ghcr.io/owner/name") }
        assertThrows<LreException.InvalidRef> { catalog.tags("Not A Name") }
    }
}
