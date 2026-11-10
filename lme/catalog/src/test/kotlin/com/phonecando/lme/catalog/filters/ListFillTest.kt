package com.phonecando.lme.catalog.filters

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.SearchPage
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals

class ListFillTest {
    // Hub pages "p1", "p2", ... of [size] hits each, the last one without a next link.
    private class Hub(private val pages: Int, private val size: Int) {
        val asked = mutableListOf<String>()

        fun page(n: Int) = SearchPage(
            (1..size).map { ModelHit("acme/p$n-$it", 0, 0, null, null, "acme/p$n-$it") },
            if (n < pages) "next-${n + 1}" else null,
        )

        fun next(link: String): SearchPage {
            asked += link
            return page(link.removePrefix("next-").toInt())
        }
    }

    // Keeps one hit in [every].
    private fun keepOneIn(every: Int): (List<ModelHit>) -> List<ModelHit> = { hits -> hits.filterIndexed { i, _ -> i % every == 0 } }

    @Test
    fun `a page that keeps enough is one request`() {
        val hub = Hub(pages = 5, size = 30)
        val page = ListFill.fill(hub.page(1), hub::next) { it }
        assertEquals(30, page.hits.size)
        assertEquals("next-2", page.next)
        assertEquals(emptyList(), hub.asked)
    }

    @Test
    fun `a sparse filter reads on until enough are kept`() {
        val hub = Hub(pages = 5, size = 100)
        // 7 of each page: two pages make 14.
        val page = ListFill.fill(hub.page(1), hub::next, keepOneIn(15))
        assertEquals(14, page.hits.size)
        assertEquals(listOf("next-2"), hub.asked)
        assertEquals("next-3", page.next)
    }

    @Test
    fun `at most three pages per list or More, and More goes on from there`() {
        val hub = Hub(pages = 9, size = 100)
        val page = ListFill.fill(hub.page(1), hub::next, keepOneIn(100))
        assertEquals(listOf("acme/p1-1", "acme/p2-1", "acme/p3-1"), page.hits.map { it.repo })
        assertEquals(listOf("next-2", "next-3"), hub.asked)
        assertEquals("next-4", page.next)
        assertEquals(ListFill.MAX_PAGES, 1 + hub.asked.size)
    }

    @Test
    fun `the list's end stops it, with nothing kept`() {
        val hub = Hub(pages = 2, size = 100)
        assertEquals(SearchPage(emptyList(), null), ListFill.fill(hub.page(1), hub::next) { emptyList() })
        assertEquals(listOf("next-2"), hub.asked)
    }

    @Test
    fun `a later page that fails keeps what came, and More asks for it again`() {
        val hub = Hub(pages = 5, size = 100)
        val offline: (String) -> SearchPage = { throw LmeException.Network("https://huggingface.co/api/models", null, null) }
        val page = ListFill.fill(hub.page(1), offline, keepOneIn(100))
        assertEquals(SearchPage(listOf(hub.page(1).hits[0]), "next-2"), page)
        // Nothing kept yet: the failure is the answer.
        assertThrows<LmeException.Network> { ListFill.fill(hub.page(1), offline) { emptyList() } }
        assertThrows<LmeException.Cancelled> { ListFill.fill(hub.page(1), { throw LmeException.Cancelled() }, keepOneIn(100)) }
    }

    @Test
    fun `a size filter asks the Hub for its longest pages`() {
        assertEquals(30, ListFill.hubLimit(ModelFilters(), 30))
        assertEquals(ListFill.SIZED_PAGE, ListFill.hubLimit(ModelFilters(size = ModelSize.UP_TO_2B), 30))
    }
}
