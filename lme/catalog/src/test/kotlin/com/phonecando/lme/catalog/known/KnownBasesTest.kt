package com.phonecando.lme.catalog.known

import com.phonecando.lme.api.model.BaseModelRef
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.catalog.hub.HubNames
import org.junit.jupiter.api.Test
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class KnownBasesTest {
    @Test
    fun `the table is keyed by real repository ids, one entry each, cutoffs never after release`() {
        val repos = KnownModels.MODELS.map { it.repo.lowercase() }
        assertEquals(repos.size, repos.toSet().size)
        for (m in KnownModels.MODELS) {
            assertTrue(HubNames.isRepo(m.repo), m.repo)
            assertTrue(m.cutoff == null || m.cutoff!! < m.released, m.repo)
        }
        assertEquals(KnownModels.QWEN35_9B, KnownModels.of("qwen/QWEN3.5-9b"))
        assertNull(KnownModels.of("Qwen/Qwen3.5-9B-Base"))
    }

    @Test
    fun `a header's Hugging Face URL decides`() {
        // What unsloth's Qwen3.5-4B Q4_K_M header says.
        assertEquals(KnownModels.QWEN35_4B, KnownBases.of(BaseModelRef("Qwen3.5 4B", "Qwen", "https://huggingface.co/Qwen/Qwen3.5-4B")))
        assertEquals(KnownModels.QWEN35_4B, KnownBases.of(BaseModelRef(null, null, "https://www.huggingface.co/Qwen/Qwen3.5-4B/tree/main")))
        // A URL to a model we do not know: no fallback to the name.
        assertNull(KnownBases.of(BaseModelRef("Qwen3.5 4B", "Qwen", "https://huggingface.co/someone/Qwen3.5-4B-Tuned")))
    }

    @Test
    fun `without one, name and organization both match, as the converter writes them`() {
        assertEquals(KnownModels.GEMMA4_E2B_IT, KnownBases.of(BaseModelRef("Gemma 4 E2B It", "Google", null)))
        assertEquals(KnownModels.GEMMA4_E2B_IT, KnownBases.of(BaseModelRef("Gemma 4 E2B It", "Google", "https://github.com/google")))
        assertNull(KnownBases.of(BaseModelRef("Gemma 4 E2B It", null, null)))
        assertNull(KnownBases.of(BaseModelRef("Gemma 4 E2B It", "Someone", null)))
        assertNull(KnownBases.of(BaseModelRef("---", "Google", null)))
    }

    @Test
    fun `a model on the phone has its saved dates first, else its header's base`() {
        val shape = ModelShape("qwen35", null, null, null, null, 1, null, KvCacheShape.NONE, BaseModelRef(null, null, "https://huggingface.co/Qwen/Qwen3.5-4B"))
        val imported = ModelRecord("q", "Q", ModelSource.Imported("q.gguf"), listOf(ModelFile("q.gguf", 1, "a".repeat(64))), shape, 0)
        assertEquals(KnownModels.QWEN35_4B.dates, KnownBases.dates(imported))
        val saved = ModelDates.OnHub(LocalDate.of(2026, 3, 2))
        assertEquals(saved, KnownBases.dates(imported.copy(dates = saved)))
        assertNull(KnownBases.dates(imported.copy(shape = shape.copy(baseModel = null))))
    }
}
