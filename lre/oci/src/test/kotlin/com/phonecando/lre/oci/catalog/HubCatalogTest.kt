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
    fun `community systems keep the list's order, Hub's words where it answers`() {
        fake.onPrefix(HubCatalog.SEARCH_NAME_URL, { reply(404, "{}") })
        fake.on(searchFor("kalilinux/kali-rolling"), { reply(200, Fixtures.bytes("catalog/search-v4-name-kali-rolling.json")) })
        val images = catalog.communityOperatingSystems()

        assertEquals(CommunityOs.CURATED.map { it.name }, images.map { it.name })
        val kali = images.first()
        assertEquals(9567812, kali.pullCount)
        assertTrue(kali.description.startsWith("Official Kali Linux Docker image"))
        assertTrue(kali.logoUrl!!.startsWith("https://www.gravatar.com/avatar/"))
        // Not found by its search: the list's own words, no pulls or logo.
        val manjaro = images.single { it.name == "manjarolinux/base" }
        assertEquals("Manjaro: Arch-based", manjaro.description)
        assertNull(manjaro.pullCount)
        assertNull(manjaro.logoUrl)
        assertEquals(CommunityOs.CURATED.size, fake.requestsTo(HubCatalog.SEARCH_NAME_URL).size)
    }

    @Test
    fun `a community system Hub lists archived or without arm64 is left out`() {
        fun hit(name: String, arch: String = "arm64", archived: Boolean = false) =
            """{"results":[{"id":"$name","name":"x","short_description":"","archived":$archived,"architectures":[{"name":"$arch"}]}]}"""
        fake.onPrefix(HubCatalog.SEARCH_NAME_URL, { reply(200, """{"results":[]}""") })
        fake.on(searchFor("parrotsec/core"), { reply(200, hit("parrotsec/core", arch = "amd64")) })
        fake.on(searchFor("opensuse/leap"), { reply(200, hit("opensuse/leap", archived = true)) })
        fake.on(searchFor("gentoo/stage3"), { reply(200, hit("gentoo/stage3")) })
        val images = catalog.communityOperatingSystems()

        assertTrue(images.none { it.name == "parrotsec/core" || it.name == "opensuse/leap" })
        // An empty description falls back to ours.
        assertEquals("Gentoo stage3: everything built from source", images.single { it.name == "gentoo/stage3" }.description)
        assertEquals(CommunityOs.CURATED.size - 2, images.size)
    }

    @Test
    fun `when every community search fails the first error is thrown`() {
        fake.onPrefix(HubCatalog.SEARCH_NAME_URL, { reply(429, "") })
        assertThrows<LreException.RateLimited> { catalog.communityOperatingSystems() }
    }

    @Test
    fun `unofficial systems page by pulls, without the official, curated or archived ones`() {
        fun hit(id: String, badge: String = "open_source", arch: String = "arm64", archived: Boolean = false, text: String = "$id os") =
            """{"id":"$id","name":"x","badge":"$badge","short_description":"$text","raw_pull_count":7,"archived":$archived,""" +
                """"architectures":[{"name":"$arch"}],"logo_url":{"small":"https://logo.test/$id.png"}}"""
        val rows = listOf(
            hit("acme/os"),
            hit("library/alpine", badge = "official"),
            hit("kalilinux/kali-rolling"),
            hit("old/os", archived = true),
            hit("x86/os", arch = "amd64"),
            hit("gone/os", text = "DEPRECATED: use acme/os"),
        ) + List(94) { hit("filler/os$it", badge = "none") }
        fake.on("${HubCatalog.UNOFFICIAL_URL}&from=100", { reply(200, """{"total":1526,"results":[${rows.joinToString(",")}]}""") })
        val page = catalog.unofficialOperatingSystems(page = 2)

        assertEquals("acme/os", page.images.first().name)
        assertEquals("https://logo.test/acme/os.png", page.images.first().logoUrl)
        assertEquals(7, page.images.first().pullCount)
        assertEquals(1 + 94, page.images.size)
        assertEquals(3, page.next)
    }

    @Test
    fun `unofficial pages end at a short page and at Hub's anonymous limit`() {
        val full = List(100) { """{"id":"a/os$it","badge":"none"}""" }.joinToString(",")
        fake.on("${HubCatalog.UNOFFICIAL_URL}&from=0", { reply(200, """{"total":40,"results":[{"id":"a/os","badge":"none"}]}""") })
        fake.on("${HubCatalog.UNOFFICIAL_URL}&from=900", { reply(200, """{"total":1526,"results":[$full]}""") })
        assertNull(catalog.unofficialOperatingSystems(page = 1).next)
        assertNull(catalog.unofficialOperatingSystems(page = 10).next)
    }

    private fun searchFor(name: String) = HubCatalog.SEARCH_NAME_URL + name.replace("/", "%2F")

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
