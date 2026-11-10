package com.phonecando.models.catalog

import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.SearchPage
import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelSort
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException

class PopularPageTest {
  private var asked = 0
  private fun fetch(): SearchPage {
    asked++
    return SearchPage(listOf(ModelHit("acme/m-$asked", 0, 0, null, null, "acme/m")), null)
  }

  @Test
  fun `the list the page opens on is asked once`() {
    val popular = PopularPage()
    val first = popular.get("", ModelFilters(), 30, ::fetch)
    assertSame(first, popular.get(" ", ModelFilters(), 30, ::fetch))
    assertEquals(1, asked)
  }

  @Test
  fun `a query, another filter or another size asks each time`() {
    val popular = PopularPage()
    popular.get("", ModelFilters(), 30, ::fetch)
    popular.get("qwen", ModelFilters(), 30, ::fetch)
    popular.get("qwen", ModelFilters(), 30, ::fetch)
    popular.get("", ModelFilters(sort = ModelSort.TRENDING), 30, ::fetch)
    popular.get("", ModelFilters(chatOnly = false), 30, ::fetch)
    assertEquals(5, asked)
    popular.get("", ModelFilters(), 10, ::fetch)
    assertEquals(6, asked)
  }

  @Test
  fun `a failed request is not kept`() {
    val popular = PopularPage()
    assertThrows(IOException::class.java) { popular.get("", ModelFilters(), 30) { throw IOException("offline") } }
    popular.get("", ModelFilters(), 30, ::fetch)
    popular.get("", ModelFilters(), 30, ::fetch)
    assertEquals(1, asked)
  }
}
