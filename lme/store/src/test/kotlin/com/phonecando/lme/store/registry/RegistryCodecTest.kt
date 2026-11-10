package com.phonecando.lme.store.registry

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.BaseModelRef
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.store.download.PendingDownload
import com.phonecando.lme.store.download.RemoteFile
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.LocalDate
import java.time.YearMonth
import kotlin.test.assertEquals

class RegistryCodecTest {
    private val shape = ModelShape(
        "gemma4", "Gemma", "Q4_K_M", 4_647_450_147, 131072, 35, 1536, KvCacheShape(3072, 6144, 512),
        BaseModelRef("Gemma 4 E2B It", "Google", "https://huggingface.co/google/gemma-4-E2B-it"),
    )
    private val registry = Registry(
        models = listOf(
            ModelRecord(
                "gemma", "Gemma", ModelSource.HuggingFace("unsloth/g", "a".repeat(40)), listOf(ModelFile("g.gguf", 9, "f".repeat(64))), shape, 1,
                ModelDates.Released(YearMonth.of(2026, 4), YearMonth.of(2025, 1)),
                context = 49_152,
            ),
            ModelRecord(
                "mine",
                "Mine",
                ModelSource.Imported("Download/mine.gguf"),
                listOf(ModelFile("mine.gguf", 3, "e".repeat(64))),
                shape.copy(name = null, quant = null, parameterCount = null, contextLength = null, embeddingLength = null, kvCache = KvCacheShape.NONE, baseModel = null),
                2,
            ),
        ),
        downloads = listOf(
            PendingDownload(
                "big", "Big", "a/b", "b".repeat(40),
                listOf(RemoteFile("big-00001-of-00002.gguf", "https://x/1", 5, "c".repeat(64)), RemoteFile("big-00002-of-00002.gguf", "https://x/2", 6, "d".repeat(64))),
                3, ModelDates.OnHub(LocalDate.of(2024, 9, 18)),
            ),
            PendingDownload("small", "Small", "a/c", "c".repeat(40), listOf(RemoteFile("s.gguf", "https://x/s", 1, "e".repeat(64))), 4, ModelDates.Released(YearMonth.of(2026, 3), null)),
        ),
    )

    @Test
    fun `round trip`() {
        assertEquals(registry, RegistryCodec.decode(RegistryCodec.encode(registry)))
        assertEquals(Registry.EMPTY, RegistryCodec.decode("""{"version":3}"""))
    }

    @Test
    fun `only our own shape reads`() {
        val good = RegistryCodec.encode(registry)
        for (bad in listOf(
            "",
            "[]",
            """{"version":1}""",
            """{"version":2}""",
            """{"version":3,"extra":true}""",
            good.replace("\"gemma\"", "\"Gemma.x\""),
            good.replace("\"mine\"", "\"gemma\""),
            good.replace("\"g.gguf\"", "\"../g.gguf\""),
            good.replace("\"imported\"", "\"elsewhere\""),
            good.replace("\"repo\": \"unsloth/g\",", ""),
            good.replace("\"fileName\": \"Download/mine.gguf\"", "\"repo\": \"x\""),
            good.replace(Regex("\"files\": \\[\\s*\\{\\s*\"name\": \"mine.gguf\"[^]]*]"), "\"files\": []"),
            good.replace(Regex("\"files\": \\[\\s*\\{\\s*\"name\": \"big-00001[^]]*]"), "\"files\": []"),
            good.replace("\"2025-01\"", "\"January 2025\""),
            good.replace("\"2024-09-18\"", "\"2024-09\""),
            good.replace("\"kind\": \"onHub\"", "\"kind\": \"guessed\""),
            good.replace("\"since\": \"2024-09-18\"", "\"released\": \"2024-09\""),
            good.replace("\"context\": 49152", "\"context\": 0"),
            good.replace("\"context\": 49152", "\"context\": \"auto\""),
        )) {
            assertThrows<LmeException.Corrupt>(bad) { RegistryCodec.decode(bad) }
        }
    }

    @Test
    fun `a chosen context is kept, automatic is left out`() {
        val text = RegistryCodec.encode(registry)
        assertEquals(1, Regex("\"context\"").findAll(text).count())
        assertEquals(listOf(49_152L, null), RegistryCodec.decode(text).models.map { it.context })
    }
}
