package com.phonecando.lme.catalog.suggested

import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.RepoFile
import com.phonecando.lme.catalog.hub.HubNames
import com.phonecando.lme.catalog.known.KnownModels
import com.phonecando.lme.catalog.support.Fixtures
import com.phonecando.network.testkit.FakePort
import com.phonecando.network.testkit.reply
import kotlinx.serialization.SerializationException
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SuggestedTest {
    @Test
    fun `every suggestion is a pinned, verifiable model file`() {
        assertEquals(listOf("Qwen3.5 4B", "Gemma 4 E2B", "Qwen3.5 9B"), Suggested.MODELS.map { it.title })
        for (m in Suggested.MODELS) {
            HubNames.repo(m.repo)
            HubNames.sha(m.revision)
            assertTrue(m.file.sha256!!.matches(Regex("[0-9a-f]{64}")), m.title)
            assertEquals("Q4_K_M", HfCatalog(FakePort()).variants(listOf(m.file)).single().quant, m.title)
        }
    }

    @Test
    fun `suggested json is read in full, each model with the shape its header gave`() {
        val (qwen4b, gemma, qwen9b) = Suggested.MODELS
        assertEquals("Balanced: our default pick", qwen4b.note)
        assertEquals(KnownModels.QWEN35_4B, qwen4b.origin)
        assertEquals(RepoFile("Qwen3.5-4B-Q4_K_M.gguf", 2_740_937_888, "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4"), qwen4b.file)
        assertEquals(262_144, qwen4b.contextLength)
        assertEquals(KvCacheShape(16_384, 0, null), qwen4b.kvCache)
        assertEquals(KvCacheShape(3_072, 6_144, 512), gemma.kvCache)
        assertEquals(KnownModels.QWEN35_9B, qwen9b.origin)
        assertEquals(listOf("unsloth/Qwen3.5-4B-GGUF", "unsloth/gemma-4-E2B-it-GGUF", "unsloth/Qwen3.5-9B-GGUF"), Suggested.MODELS.map { it.repo })
    }

    @Test
    fun `suggested json is strict`() {
        val text = SuggestedJson::class.java.getResourceAsStream(SuggestedJson.RESOURCE)!!.use { it.readBytes().decodeToString() }
        assertEquals(Suggested.MODELS, SuggestedJson.decode(text).models)
        // An unknown field, a missing one, an origin we never dated: refused.
        assertFailsWith<SerializationException> { SuggestedJson.decode(text.replace("\"note\":", "\"blurb\":")) }
        assertFailsWith<SerializationException> { SuggestedJson.decode(text.replace(", \"slidingWindow\": null", "")) }
        val unknown = assertFailsWith<IllegalArgumentException> { SuggestedJson.decode(text.replace("Qwen/Qwen3.5-9B\"", "Qwen/Qwen9\"")) }
        assertEquals("Qwen3.5 9B: no known model Qwen/Qwen9", unknown.message)
    }

    @Test
    fun `suggestions match the recorded listings`() {
        val fake = FakePort()
        val catalog = HfCatalog(fake)
        for ((fixture, title) in listOf("revision-qwen35-4b.json" to "Qwen3.5 4B", "revision-gemma4-e2b.json" to "Gemma 4 E2B")) {
            val m = Suggested.MODELS.single { it.title == title }
            fake.onPrefix("https://huggingface.co/api/models/${m.repo}/revision/${m.revision}?") { reply(200, Fixtures.text(fixture)) }
            assertTrue(m.file in catalog.revision(m.repo, m.revision).files, title)
        }
    }

    @Test
    fun `each suggestion's original model is the one its repository's card names, so its dates are that model's`() {
        val fake = FakePort()
        val catalog = HfCatalog(fake)
        val fixtures = listOf("revision-qwen35-4b.json", "revision-gemma4-e2b.json", "revision-qwen35-9b.json")
        for ((m, fixture) in Suggested.MODELS.zip(fixtures)) {
            fake.onPrefix("https://huggingface.co/api/models/${m.repo}/revision/main?") { reply(200, Fixtures.text(fixture)) }
            val revision = catalog.revision(m.repo)
            assertEquals(m.revision, revision.sha, m.title)
            assertEquals(m.origin.repo, revision.origin, m.title)
        }
    }
}
