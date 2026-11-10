package com.phonecando.lme.catalog.suggested

import com.phonecando.lme.api.testkit.FakePort
import com.phonecando.lme.api.testkit.reply
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.hub.HubNames
import com.phonecando.lme.catalog.support.Fixtures
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
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
    fun `suggestions match the recorded listings`() {
        val fake = FakePort()
        val catalog = HfCatalog(fake)
        for ((fixture, title) in listOf("tree-qwen35-4b.json" to "Qwen3.5 4B", "tree-gemma4-e2b.json" to "Gemma 4 E2B")) {
            val m = Suggested.MODELS.single { it.title == title }
            fake.on("https://huggingface.co/api/models/${m.repo}/tree/${m.revision}?recursive=true", { reply(200, Fixtures.text(fixture)) })
            assertTrue(m.file in catalog.files(m.repo, m.revision), title)
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
