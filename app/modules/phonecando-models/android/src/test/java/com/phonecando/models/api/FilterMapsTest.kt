package com.phonecando.models.api

import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelLicense
import com.phonecando.lme.catalog.filters.ModelSize
import com.phonecando.lme.catalog.filters.ModelSort
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class FilterMapsTest {
  @Test
  fun `the defaults, and every value JS sends`() {
    assertEquals(ModelFilters(), filtersOf(mapOf("sort" to "downloads", "chatOnly" to true)))
    assertEquals(ModelFilters(), filtersOf(emptyMap()))
    assertEquals(
      ModelFilters(ModelSort.TRENDING, ModelSize.UP_TO_2B, ModelLicense.APACHE_2_0, chatOnly = false),
      filtersOf(mapOf("sort" to "trending", "size" to "up_to_2b", "license" to "apache-2.0", "chatOnly" to false)),
    )
    assertEquals(
      listOf(ModelSort.DOWNLOADS, ModelSort.TRENDING, ModelSort.UPDATED, ModelSort.LIKES),
      listOf("downloads", "trending", "updated", "likes").map { filtersOf(mapOf("sort" to it)).sort },
    )
    assertEquals(
      ModelSize.entries,
      listOf("up_to_2b", "2b_to_5b", "5b_to_10b", "over_10b").map { filtersOf(mapOf("size" to it)).size },
    )
    assertEquals(ModelLicense.MIT, filtersOf(mapOf("license" to "mit")).license)
    assertEquals(ModelFilters(), filtersOf(mapOf("size" to null, "license" to null)))
  }

  @Test
  fun `an unknown value is refused`() {
    assertThrows(IllegalArgumentException::class.java) { filtersOf(mapOf("sort" to "newest")) }
    assertThrows(IllegalArgumentException::class.java) { filtersOf(mapOf("size" to "tiny")) }
    assertThrows(IllegalArgumentException::class.java) { filtersOf(mapOf("license" to "gpl-3.0")) }
  }
}
