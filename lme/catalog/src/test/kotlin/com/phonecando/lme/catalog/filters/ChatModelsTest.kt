package com.phonecando.lme.catalog.filters

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class ChatModelsTest {
    @Test
    fun `chat tasks stay, the rest goes`() {
        // The tasks we met on GGUF repositories tagged conversational (2026-11-09).
        val kept = listOf(null, "text-generation", "image-text-to-text", "audio-text-to-text", "video-text-to-text", "any-to-any")
        val dropped = listOf(
            "text-ranking", "feature-extraction", "sentence-similarity", "text-classification",
            "text-to-speech", "automatic-speech-recognition", "text-to-image", "image-text-to-video", "text2text-generation",
        )
        assertEquals(kept, kept.filter(ChatModels::keeps))
        assertEquals(emptyList(), dropped.filter(ChatModels::keeps))
    }
}
