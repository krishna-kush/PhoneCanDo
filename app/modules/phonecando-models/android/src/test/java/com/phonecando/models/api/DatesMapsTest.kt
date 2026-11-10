package com.phonecando.models.api

import com.phonecando.lme.api.model.ModelDates
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

class DatesMapsTest {
  @Test
  fun `dates go to JS and come back the same`() {
    val released = ModelDates.Released(YearMonth.of(2026, 4), YearMonth.of(2025, 1))
    assertEquals(mapOf("kind" to "released", "released" to "2026-04", "cutoff" to "2025-01"), datesMap(released))
    val unpublished = ModelDates.Released(YearMonth.of(2026, 3), null)
    val onHub = ModelDates.OnHub(LocalDate.of(2024, 9, 18))
    assertEquals(mapOf("kind" to "on_hub", "since" to "2024-09-18"), datesMap(onHub))
    for (d in listOf(released, unpublished, onHub)) assertEquals(d, datesOf(datesMap(d)))
    assertNull(datesMap(null))
  }

  @Test
  fun `anything else from JS is no dates`() {
    for (raw in listOf(
      null,
      "2026-03",
      mapOf("kind" to "released"),
      mapOf("kind" to "released", "released" to "March 2026"),
      mapOf("kind" to "on_hub", "since" to "2024-09"),
      mapOf("kind" to "guessed", "released" to "2026-03"),
    )) {
      assertNull("$raw", datesOf(raw))
    }
  }
}
