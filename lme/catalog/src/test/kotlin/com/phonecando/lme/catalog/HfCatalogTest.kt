package com.phonecando.lme.catalog

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.testkit.FakePort
import com.phonecando.lme.api.testkit.reply
import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelLicense
import com.phonecando.lme.catalog.filters.ModelSize
import com.phonecando.lme.catalog.filters.ModelSort
import com.phonecando.lme.catalog.support.Fixtures
import com.phonecando.lme.catalog.support.Fixtures.GEMMA_E2B
import com.phonecando.lme.catalog.support.Fixtures.GEMMA_E2B_SHA
import com.phonecando.lme.catalog.support.Fixtures.QWEN_122B
import com.phonecando.lme.catalog.support.Fixtures.QWEN_122B_SHA
import com.phonecando.lme.catalog.support.Fixtures.QWEN_4B
import com.phonecando.lme.catalog.support.Fixtures.QWEN_4B_SHA
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class HfCatalogTest {
    private val fake = FakePort()
    private val api = "https://huggingface.co/api/models"
    private val searchUrl = "$api?filter=gguf&sort=downloads&direction=-1&limit=5&search=qwen3.5-4b"
    private val everyModel = ModelFilters(chatOnly = false)
    private fun treeUrl(repo: String, sha: String) = "$api/$repo/tree/$sha?recursive=true"
    private fun revisionUrl(repo: String) =
        "$api/$repo/revision/main?expand%5B%5D=sha&expand%5B%5D=gated&expand%5B%5D=cardData&expand%5B%5D=tags&expand%5B%5D=createdAt"

    @Test
    fun `search lists repositories, most downloaded first, with the next cursor`() {
        val next = "$api?search=qwen3.5-4b&filter=gguf&sort=downloads&direction=-1&limit=5&cursor=abc"
        fake.on(searchUrl, { reply(200, Fixtures.text("search-qwen35-4b.json"), mapOf("Link" to "<$next>; rel=\"next\"")) })
        val page = HfCatalog(fake).search("  qwen3.5-4b ", everyModel, limit = 5)

        assertEquals(5, page.hits.size)
        assertEquals(
            ModelHit("unsloth/Qwen3.5-4B-GGUF", 1530019, 547, "image-text-to-text", LocalDate.of(2026, 3, 2), "Qwen/Qwen3.5-4B"),
            page.hits[0],
        )
        assertEquals(next, page.next)
        assertEquals("application/json", fake.requests[0].header("accept"))
        assertNull(fake.requests[0].header("authorization"))
    }

    @Test
    fun `the next page uses the cursor as given, and a blank query lists every GGUF repository`() {
        val cursor = "$api?filter=gguf&cursor=abc"
        fake.on(cursor, { reply(200, "[]") })
        assertEquals(SearchPage(emptyList(), null), HfCatalog(fake).nextPage(cursor))
        assertThrows<IllegalArgumentException> { HfCatalog(fake).nextPage("https://evil.example/api/models?x") }

        fake.on("$api?filter=gguf&sort=downloads&direction=-1&limit=30", { reply(200, "[]") })
        assertEquals(emptyList(), HfCatalog(fake).search(" ", everyModel).hits)
    }

    @Test
    fun `before any query, the default filters list GGUF chat models, most downloaded first`() {
        val url = "$api?filter=gguf&filter=conversational&sort=downloads&direction=-1&limit=5"
        val next = "$url&cursor=eyIkb3IiOlt7ImRvd25sb2FkcyI6NDIxNTAwM30"
        fake.on(url, { reply(200, Fixtures.text("popular-gguf.json"), mapOf("Link" to "<$next>; rel=\"next\"")) })
        fake.on(next, { reply(200, "[]") })
        val catalog = HfCatalog(fake)
        val page = catalog.search("", limit = 5)

        assertEquals(
            ModelHit(
                "ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF", 6843896, 1206, "image-text-to-text", LocalDate.of(2026, 9, 7),
                "Qwen/Qwen3.8-Flash-Next",
            ),
            page.hits[0],
        )
        assertEquals(
            mapOf(
                "ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF" to "Qwen/Qwen3.8-Flash-Next",
                "unsloth/Qwen3.8-27B-GGUF" to "Qwen/Qwen3.8-27B",
                // No base_model at all: its own model.
                "ornith-ai/Ornith-1.5-9B-GGUF" to "ornith-ai/Ornith-1.5-9B-GGUF",
                "huihui-ai/Huihui-Qwen3.6-35B-A3B-abliterated-MTP-GGUF" to "Qwen/Qwen3.6-35B-A3B",
                // A quantization of another GGUF repository: that one is its original.
                "SC117/Qwen3.8-Flash-Next-GSQ-RCO-abliterated-GGUF" to "ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF",
            ),
            page.hits.associate { it.repo to it.origin },
        )
        assertEquals(page.hits.sortedByDescending { it.downloads }, page.hits)
        assertEquals(next, page.next)
        assertEquals(SearchPage(emptyList(), null), catalog.nextPage(page.next!!))
        assertThrows<IllegalArgumentException> { catalog.search("", limit = 0) }
    }

    @Test
    fun `every filter goes into the request, and the next page keeps them`() {
        // The size stays ours (parameters.ModelSizes); the response is the one recorded with the Hub's num_parameters.
        val url = "$api?filter=gguf&filter=conversational&filter=license%3Aapache-2.0&sort=trendingScore&direction=-1&limit=5"
        val next = "$url&cursor=eyJ0cmVuZGluZ1Njb3JlIjozMH0"
        fake.on(url, { reply(200, Fixtures.text("filtered-gguf.json"), mapOf("Link" to "<$next>; rel=\"next\"")) })
        val filters = ModelFilters(ModelSort.TRENDING, ModelSize.FROM_2B_TO_5B, ModelLicense.APACHE_2_0)
        val catalog = HfCatalog(fake)
        val page = catalog.search(" ", filters, limit = 5)
        assertEquals(
            listOf(
                "ccore/Qwen3.5-4B-3D-Coder",
                "ccore/Qwen3.5-4B-GLB-3D-Coder",
                "aj9o9/Qwen3.8-27B-DSpine-b16-GGUF",
                "XHToken/Spark-X2.6-4B-GGUF",
                "HauhauCS/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive",
            ),
            page.hits.map { it.repo },
        )
        assertEquals(next, page.next)

        // The Hub's link carries the chat filter on, and so does what we keep of its page.
        fake.on(next, { reply(200, """[{"id":"a/chat","pipeline_tag":"text-generation"},{"id":"a/rank","pipeline_tag":"text-ranking"}]""") })
        assertEquals(listOf("a/chat"), catalog.nextPage(next).hits.map { it.repo })
    }

    @Test
    fun `chat models only leaves out rerankers the Hub files as text-ranking`() {
        fake.on("$api?filter=gguf&filter=conversational&sort=downloads&direction=-1&limit=5&search=rerank", {
            reply(200, Fixtures.text("search-rerank-chat.json"))
        })
        // The two the Hub gives no task at all stay: nothing in the listing says what they are.
        assertEquals(
            listOf("mradermacher/Qwen3-VL-Reranker-8B-GGUF", "mradermacher/Qwen3-VL-Reranker-2B-i1-GGUF"),
            HfCatalog(fake).search("rerank", limit = 5).hits.map { it.repo },
        )
    }

    @Test
    fun `a hit's original model comes from its base_model tags, unless it is a finetune of it`() {
        fake.on(searchUrl, { reply(200, Fixtures.text("search-qwen35-4b.json")) })
        val origins = HfCatalog(fake).search("qwen3.5-4b", everyModel, 5).hits.associate { it.repo to it.origin }
        assertEquals(
            mapOf(
                "unsloth/Qwen3.5-4B-GGUF" to "Qwen/Qwen3.5-4B",
                // No base_model at all: its own model.
                "HauhauCS/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive" to "HauhauCS/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive",
                // base_model:finetune:Qwen/Qwen3.5-4B
                "ccore/Qwen3.5-4B-3D-Coder" to "ccore/Qwen3.5-4B-3D-Coder",
                "turintech/Qwen3.5-4B-Artemis-GGUF" to "Qwen/Qwen3.5-4B",
                "lmstudio-community/Qwen3.5-4B-GGUF" to "Qwen/Qwen3.5-4B",
            ),
            origins,
        )
    }

    @Test
    fun `search drops hits that are not repository names`() {
        fake.on(searchUrl, { reply(200, """[{"id":"a/b"},{"id":"../x"},{"id":"no-owner"}]""") })
        assertEquals(listOf("a/b"), HfCatalog(fake).search("qwen3.5-4b", everyModel, 5).hits.map { it.repo })
    }

    @Test
    fun `a revision resolves to its commit and says whether it is gated`() {
        fake.on(revisionUrl(QWEN_4B), { reply(200, Fixtures.text("revision-qwen35-4b.json")) })
        assertEquals(
            RepoRevision(QWEN_4B, QWEN_4B_SHA, gated = false, origin = "Qwen/Qwen3.5-4B", createdAt = LocalDate.of(2026, 3, 2)),
            HfCatalog(fake).revision(QWEN_4B),
        )

        val gatedRepo = "meta-llama/Llama-3.2-1B-Instruct"
        fake.on(revisionUrl(gatedRepo), { reply(200, Fixtures.text("revision-llama-gated.json")) })
        val gated = HfCatalog(fake).revision(gatedRepo)
        assertTrue(gated.gated)
        // No base_model: the original model is the repository itself.
        assertEquals(gatedRepo, gated.origin)
        assertEquals(LocalDate.of(2024, 9, 18), gated.createdAt)
    }

    @Test
    fun `a revision's original model is its card's first base_model, a string or a list, unless it is a finetune of it`() {
        val catalog = HfCatalog(fake)
        val cases = mapOf(
            GEMMA_E2B to ("revision-gemma4-e2b.json" to "google/gemma-4-E2B-it"),
            "unsloth/Qwen3.5-9B-GGUF" to ("revision-qwen35-9b.json" to "Qwen/Qwen3.5-9B"),
            "bartowski/Llama-3.2-1B-Instruct-GGUF" to ("revision-llama-1b-gguf.json" to "meta-llama/Llama-3.2-1B-Instruct"),
            // base_model_relation: finetune in its card
            "ccore/Qwen3.5-4B-3D-Coder" to ("revision-qwen35-4b-finetune.json" to "ccore/Qwen3.5-4B-3D-Coder"),
        )
        for ((repo, case) in cases) {
            fake.on(revisionUrl(repo), { reply(200, Fixtures.text(case.first)) })
            assertEquals(case.second, catalog.revision(repo).origin, repo)
        }
    }

    @Test
    fun `an original model's creation day and checkpoint size`() {
        fun origin(repo: String, fixture: String): OriginFacts {
            fake.on("$api/$repo?expand%5B%5D=createdAt&expand%5B%5D=safetensors", { reply(200, Fixtures.text(fixture)) })
            return HfCatalog(fake).origin(repo)
        }
        assertEquals(OriginFacts(LocalDate.of(2026, 2, 28), 2_274_069_824L), origin("Qwen/Qwen3.5-2B", "origin-qwen35-2b.json"))
        assertEquals(OriginFacts(LocalDate.of(2026, 8, 24), 179_999_981_459L), origin("Qwen/Qwen3.8-Flash-Next", "origin-qwen38-flash-next.json"))
        assertEquals(OriginFacts(LocalDate.of(2026, 3, 2), 5_123_178_051L), origin("google/gemma-4-E2B-it", "origin-gemma4-e2b.json"))
        // Mostly I8: a lower bound, kept since it is past 10B.
        assertEquals(OriginFacts(LocalDate.of(2026, 4, 22), 290_944_616_402L), origin("deepseek-ai/DeepSeek-V4-Flash", "origin-deepseek-v4-flash.json"))
        // No checkpoint on the Hub (a GGUF-only repository answers without the field).
        assertEquals(OriginFacts(LocalDate.of(2024, 9, 18), null), origin("meta-llama/Llama-3.2-1B-Instruct", "created-llama-1b.json"))

        val odd = "$api/acme/m?expand%5B%5D=createdAt&expand%5B%5D=safetensors"
        fake.on(odd, { reply(200, """{"id":"acme/m"}""") }, { reply(200, """{"createdAt":"last spring","safetensors":"big"}""") })
        assertEquals(OriginFacts(null, null), HfCatalog(fake).origin("acme/m"))
        assertEquals(OriginFacts(null, null), HfCatalog(fake).origin("acme/m"))
        assertThrows<LmeException.InvalidName> { HfCatalog(fake).origin("../x") }
    }

    @Test
    fun `a token goes to the Hub as a bearer and never into an error`() {
        val url = revisionUrl("acme/missing")
        fake.on(url, { reply(401, Fixtures.text("error-401.json")) })
        val e = assertThrows<LmeException.AccessDenied> { HfCatalog(fake, token = "hf_secret").revision("acme/missing") }
        assertEquals("Bearer hf_secret", fake.requests[0].header("authorization"))
        assertFalse("hf_secret" in e.message!!)
        assertEquals("no access to repository acme/missing", e.message)
    }

    @Test
    fun `hub statuses become typed errors`() {
        val url = revisionUrl("acme/m")
        fake.on(url, { reply(404, "{}") }, { reply(429, "{}") }, { reply(500, "{}") }, { reply(200, """{"sha":"nope"}""") }, { reply(200, "<html>") })
        val catalog = HfCatalog(fake)
        assertThrows<LmeException.NotFound> { catalog.revision("acme/m") }
        assertThrows<LmeException.RateLimited> { catalog.revision("acme/m") }
        assertThrows<LmeException.Network> { catalog.revision("acme/m") }
        assertThrows<LmeException.Corrupt> { catalog.revision("acme/m") }
        assertThrows<LmeException.Corrupt> { catalog.revision("acme/m") }
    }

    @Test
    fun `names are checked before any request`() {
        val catalog = HfCatalog(fake)
        assertThrows<LmeException.InvalidName> { catalog.revision("../../etc") }
        assertThrows<LmeException.InvalidName> { catalog.files(QWEN_4B, "main") }
        assertThrows<LmeException.Cancelled> { catalog.revision(QWEN_4B, cancel = { true }) }
        assertEquals(0, fake.requests.size)
    }

    @Test
    fun `files list sizes and LFS sha256s, and the variants skip companions`() {
        fake.on(treeUrl(QWEN_4B, QWEN_4B_SHA), { reply(200, Fixtures.text("tree-qwen35-4b.json")) })
        val catalog = HfCatalog(fake)
        val files = catalog.files(QWEN_4B, QWEN_4B_SHA)

        assertEquals(8, files.size)
        val q4 = files.single { it.path == "Qwen3.5-4B-Q4_K_M.gguf" }
        assertEquals(2_740_937_888, q4.sizeBytes)
        assertEquals("00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4", q4.sha256)
        assertNull(files.single { it.path == "README.md" }.sha256)

        val variants = catalog.variants(files)
        assertEquals(listOf("IQ4_XS", "Q4_K_M", "UD-Q4_K_XL", "BF16"), variants.map { it.quant })
        assertEquals(
            "https://huggingface.co/$QWEN_4B/resolve/$QWEN_4B_SHA/Qwen3.5-4B-Q4_K_M.gguf",
            catalog.downloadUrl(QWEN_4B, QWEN_4B_SHA, q4),
        )
    }

    @Test
    fun `subfolders are listed and companion GGUF files are not models`() {
        fake.on(treeUrl(GEMMA_E2B, GEMMA_E2B_SHA), { reply(200, Fixtures.text("tree-gemma4-e2b.json")) })
        val catalog = HfCatalog(fake)
        val files = catalog.files(GEMMA_E2B, GEMMA_E2B_SHA)
        assertTrue(files.any { it.path == "MTP/mtp-gemma-4-E2B-it-Q8_0.gguf" })
        assertTrue(files.none { it.path == "MTP" })
        assertEquals(listOf("gemma-4-E2B-it-Q4_K_M.gguf", "gemma-4-E2B-it-Q8_0.gguf"), catalog.variants(files).map { it.entry.path })
    }

    @Test
    fun `a split model is one variant of every part, in order, and an incomplete one is dropped`() {
        fake.on(treeUrl(QWEN_122B, QWEN_122B_SHA), { reply(200, Fixtures.text("tree-qwen35-122b.json")) })
        val catalog = HfCatalog(fake)
        val variants = catalog.variants(catalog.files(QWEN_122B, QWEN_122B_SHA))

        val q4 = variants.single()
        assertEquals("Q4_K_M", q4.quant)
        assertEquals((1..3).map { "Q4_K_M/Qwen3.5-122B-A10B-Q4_K_M-0000$it-of-00003.gguf" }, q4.files.map { it.path })
        assertEquals(10_943_552L + 49_968_146_912 + 26_557_874_144, q4.sizeBytes)
        assertEquals(
            "https://huggingface.co/$QWEN_122B/resolve/$QWEN_122B_SHA/Q4_K_M/Qwen3.5-122B-A10B-Q4_K_M-00001-of-00003.gguf",
            catalog.downloadUrl(QWEN_122B, QWEN_122B_SHA, q4.entry),
        )
    }

    @Test
    fun `listing pages are followed on the Hub only, and unsafe entries dropped`() {
        val first = treeUrl("acme/m", QWEN_4B_SHA)
        val second = "$api/acme/m/tree/$QWEN_4B_SHA?recursive=true&cursor=2"
        val lfs = """"lfs":{"oid":"${"a".repeat(64)}","size":5}"""
        fake.on(first, { reply(200, """[{"type":"file","path":"a.gguf","size":5,$lfs}]""", mapOf("Link" to "<$second>; rel=\"next\"")) })
        fake.on(
            second,
            {
                reply(
                    200,
                    """[{"type":"file","path":"../b.gguf","size":5},{"type":"file","path":"c/./d","size":1},""" +
                        """{"type":"file","path":"e.gguf","size":6,$lfs},{"type":"file","path":"f","size":-1}]""",
                    mapOf("Link" to "<https://evil.example/next>; rel=\"next\""),
                )
            },
        )
        val files = HfCatalog(fake, token = "hf_x").files("acme/m", QWEN_4B_SHA)
        assertEquals(listOf(RepoFile("a.gguf", 5, "a".repeat(64)), RepoFile("e.gguf", 6, null)), files)
        assertEquals(2, fake.requests.size)
    }

    @Test
    fun `a listing that never ends is cut off`() {
        val url = treeUrl("acme/m", QWEN_4B_SHA)
        fake.onPrefix(url) { reply(200, "[]", mapOf("Link" to "<$url&cursor=again>; rel=\"next\"")) }
        assertThrows<LmeException.TooLarge> { HfCatalog(fake).files("acme/m", QWEN_4B_SHA) }
    }

    @Test
    fun `cancel stops between pages`() {
        val url = treeUrl("acme/m", QWEN_4B_SHA)
        fake.onPrefix(url) { reply(200, "[]", mapOf("Link" to "<$url&cursor=again>; rel=\"next\"")) }
        var calls = 0
        assertThrows<LmeException.Cancelled> { HfCatalog(fake).files("acme/m", QWEN_4B_SHA, CancelSignal { ++calls > 2 }) }
        assertEquals(2, fake.requests.size)
    }
}
