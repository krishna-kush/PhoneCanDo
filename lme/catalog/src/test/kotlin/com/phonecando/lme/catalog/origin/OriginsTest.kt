package com.phonecando.lme.catalog.origin

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class OriginsTest {
    private val repo = "acme/M-GGUF"
    private fun str(s: String) = JsonPrimitive(s)

    @Test
    fun `the card's first base model, as a string or a list`() {
        assertEquals("org/M", Origins.fromCard(repo, str("org/M"), null, emptyList()))
        assertEquals("org/M", Origins.fromCard(repo, JsonArray(listOf(str(" org/M "), str("org/Other"))), null, emptyList()))
    }

    @Test
    fun `with no usable base model the original is the repository itself`() {
        for (base in listOf(null, JsonNull, JsonArray(emptyList()), JsonPrimitive(3), JsonObject(emptyMap()), str("no-owner"), str("../x"))) {
            assertEquals(repo, Origins.fromCard(repo, base, null, emptyList()), "$base")
        }
    }

    @Test
    fun `a finetune, merge or adapter is its own model, whether the card or the tags say so`() {
        for (relation in listOf("finetune", "merge", "Adapter")) {
            assertEquals(repo, Origins.fromCard(repo, str("org/M"), str(relation), emptyList()), relation)
            assertEquals(repo, Origins.fromCard(repo, str("org/M"), null, listOf("base_model:$relation:org/M")), relation)
        }
        assertEquals("org/M", Origins.fromCard(repo, str("org/M"), str("quantized"), listOf("base_model:finetune:org/M")))
        // A relation to another base says nothing about this one.
        assertEquals("org/M", Origins.fromCard(repo, str("org/M"), null, listOf("base_model:finetune:org/Other")))
    }

    @Test
    fun `a search hit's tags alone`() {
        assertEquals("org/M", Origins.fromTags(repo, listOf("gguf", "base_model:org/M", "base_model:quantized:org/M")))
        assertEquals(repo, Origins.fromTags(repo, listOf("base_model:org/M", "base_model:finetune:org/M")))
        assertEquals("org/M", Origins.fromTags(repo, listOf("base_model:quantized:org/M")))
        assertEquals(repo, Origins.fromTags(repo, listOf("gguf", "license:apache-2.0")))
        assertEquals("org/A", Origins.fromTags(repo, listOf("base_model:org/A", "base_model:org/B")))
    }
}
