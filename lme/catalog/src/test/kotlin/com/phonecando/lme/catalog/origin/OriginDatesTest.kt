package com.phonecando.lme.catalog.origin

import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.known.KnownModels
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.YearMonth
import kotlin.test.assertEquals
import kotlin.test.assertNull

class OriginDatesTest {
    private val day = LocalDate.of(2026, 3, 2)
    private val lookups = mutableListOf<String>()
    private val lookup = { repo: String -> lookups += repo; LocalDate.of(2024, 9, 18) }

    @Test
    fun `a conversion of a model we know has its vendor's dates, with no request`() {
        val hit = ModelHit("lmstudio-community/Qwen3.5-4B-GGUF", 0, 0, null, day, "qwen/qwen3.5-4b")
        assertEquals(ModelDates.Released(YearMonth.of(2026, 3), null), OriginDates.of(hit, lookup))
        assertEquals(KnownModels.GEMMA4_E2B_IT.dates, OriginDates.of("u/g", "google/gemma-4-E2B-it", day, lookup))
        assertNull(OriginDates.lookupFor(hit.repo, hit.origin))
        assertEquals(emptyList(), lookups)
    }

    @Test
    fun `a model of its own has the day its repository was created`() {
        assertEquals(ModelDates.OnHub(day), OriginDates.of("ccore/Coder", "ccore/Coder", day, lookup))
        assertNull(OriginDates.of("ccore/Coder", "ccore/Coder", null, lookup))
        assertNull(OriginDates.lookupFor("ccore/Coder", "CCORE/coder"))
        assertEquals(emptyList(), lookups)
    }

    @Test
    fun `a conversion of another model has the day the original was created`() {
        val repo = "bartowski/Llama-3.2-1B-Instruct-GGUF"
        val origin = "meta-llama/Llama-3.2-1B-Instruct"
        assertEquals(origin, OriginDates.lookupFor(repo, origin))
        assertEquals(ModelDates.OnHub(LocalDate.of(2024, 9, 18)), OriginDates.of(repo, origin, day, lookup))
        assertEquals(listOf(origin), lookups)
        assertNull(OriginDates.of(repo, origin, day) { null })
    }
}
