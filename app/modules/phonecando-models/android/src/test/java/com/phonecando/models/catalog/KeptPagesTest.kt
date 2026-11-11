package com.phonecando.models.catalog

import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.SearchPage
import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelSort
import com.phonecando.models.catalog.KeptPages.First
import com.phonecando.models.catalog.KeptPages.Next
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException

class KeptPagesTest {
  private var asked = 0
  private fun fetch(): SearchPage {
    asked++
    return SearchPage(listOf(ModelHit("acme/m-$asked", 0, 0, null, null, "acme/m")), null)
  }

  @Test
  fun `a page read before is kept, a first page and a More alike`() {
    val kept = KeptPages()
    val first = kept.get(First("", ModelFilters(), 30), ::fetch)
    assertSame(first, kept.get(First("", ModelFilters(), 30), ::fetch))
    val more = kept.get(Next("any https://huggingface.co/api/models?cursor=2"), ::fetch)
    assertSame(more, kept.get(Next("any https://huggingface.co/api/models?cursor=2"), ::fetch))
    assertEquals(2, asked)
  }

  @Test
  fun `another query, filter or limit is another page, and one set back asks nothing`() {
    val kept = KeptPages()
    kept.get(First("", ModelFilters(), 30), ::fetch)
    kept.get(First("qwen", ModelFilters(), 30), ::fetch)
    kept.get(First("", ModelFilters(sort = ModelSort.TRENDING), 30), ::fetch)
    kept.get(First("", ModelFilters(chatOnly = false), 30), ::fetch)
    kept.get(First("", ModelFilters(), 10), ::fetch)
    assertEquals(5, asked)
    kept.get(First("qwen", ModelFilters(), 30), ::fetch)
    kept.get(First("", ModelFilters(), 30), ::fetch)
    assertEquals(5, asked)
  }

  @Test
  fun `only the most recently used pages are kept`() {
    val kept = KeptPages()
    for (i in 0..24) kept.get(First("q$i", ModelFilters(), 30), ::fetch)
    assertEquals(25, asked)
    kept.get(First("q24", ModelFilters(), 30), ::fetch)
    assertEquals(25, asked)
    kept.get(First("q0", ModelFilters(), 30), ::fetch)
    assertEquals(26, asked)
  }

  @Test
  fun `a failed request is not kept, and clear forgets every page`() {
    val kept = KeptPages()
    assertThrows(IOException::class.java) { kept.get(First("", ModelFilters(), 30)) { throw IOException("offline") } }
    kept.get(First("", ModelFilters(), 30), ::fetch)
    kept.get(First("", ModelFilters(), 30), ::fetch)
    assertEquals(1, asked)
    kept.clear()
    kept.get(First("", ModelFilters(), 30), ::fetch)
    assertEquals(2, asked)
  }
}
