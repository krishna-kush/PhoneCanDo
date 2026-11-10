package com.phonecando.lme.catalog.hub

import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelLicense
import com.phonecando.lme.catalog.filters.ModelSize
import com.phonecando.lme.catalog.filters.ModelSort
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class HubUrlsTest {
    private val api = "https://huggingface.co/api/models"

    // Each parameter as we checked it against the Hub (2026-11-09): every sort answers 200,
    // license:<id> keeps that licence. The size is ours: it never goes to the Hub.
    @Test
    fun `sorts, sizes and licences`() {
        val sorts = ModelSort.entries.associateWith { HubUrls.search("", ModelFilters(sort = it, chatOnly = false), 30) }
        assertEquals(
            mapOf(
                ModelSort.DOWNLOADS to "$api?filter=gguf&sort=downloads&direction=-1&limit=30",
                ModelSort.TRENDING to "$api?filter=gguf&sort=trendingScore&direction=-1&limit=30",
                ModelSort.UPDATED to "$api?filter=gguf&sort=lastModified&direction=-1&limit=30",
                ModelSort.LIKES to "$api?filter=gguf&sort=likes&direction=-1&limit=30",
            ),
            sorts,
        )
        val sizes = ModelSize.entries.map { HubUrls.search("", ModelFilters(size = it, chatOnly = false), 30) }.distinct()
        assertEquals(listOf("$api?filter=gguf&sort=downloads&direction=-1&limit=30"), sizes)
        assertEquals(
            "$api?filter=gguf&filter=conversational&filter=license%3Amit&sort=downloads&direction=-1&limit=5&search=qwen%203.5",
            HubUrls.search(" qwen 3.5 ", ModelFilters(license = ModelLicense.MIT), 5),
        )
    }

    @Test
    fun `an original model's lookup asks for its creation day and checkpoint size`() {
        assertEquals("$api/Qwen/Qwen3.5-2B?expand%5B%5D=createdAt&expand%5B%5D=safetensors", HubUrls.origin("Qwen/Qwen3.5-2B"))
    }

    @Test
    fun `chat only is read back from a listing's own URL`() {
        assertTrue(HubUrls.isChatOnly(HubUrls.search("", ModelFilters(), 30)))
        assertFalse(HubUrls.isChatOnly(HubUrls.search("", ModelFilters(chatOnly = false), 30)))
        assertTrue(HubUrls.isChatOnly("$api?filter=gguf&filter=conversational&sort=likes&cursor=x"))
        assertFalse(HubUrls.isChatOnly("$api?filter=gguf&search=filter%3Dconversational"))
        assertFalse(HubUrls.isChatOnly(api))
    }
}
