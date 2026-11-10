package com.phonecando.lme.catalog.filters

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.SearchPage

/**
 * How one list, or one More, fills its page when we drop hits the Hub
 * returned (a size filter, chat models only): read the Hub's next pages
 * until [ENOUGH] are kept, the list ends or [MAX_PAGES] pages were read.
 * Under a size filter each Hub page is [SIZED_PAGE] long (the Hub's most),
 * since a bucket can keep only a few of each page. A later page that
 * fails ends the page with what was kept, and More asks for it again.
 * Pure: the caller makes the requests.
 */
object ListFill {
    /** Hub pages one list or one More reads at most. */
    const val MAX_PAGES = 3

    /** Kept hits that make a page worth showing. */
    const val ENOUGH = 10

    /** Hits per Hub page under a size filter. */
    const val SIZED_PAGE = 100

    /** Hits to ask the Hub for per page: the caller's [limit], or [SIZED_PAGE] under a size filter. */
    fun hubLimit(filters: ModelFilters, limit: Int): Int = if (filters.size == null) limit else SIZED_PAGE

    /**
     * [first] and the pages after it, read with [next], each kept by [keep],
     * as one page; its `next` is the Hub's link after the last page read.
     */
    fun fill(first: SearchPage, next: (String) -> SearchPage, keep: (List<ModelHit>) -> List<ModelHit>): SearchPage {
        val kept = ArrayList<ModelHit>()
        var page = first
        var read = 1
        while (true) {
            kept += keep(page.hits)
            val link = page.next
            if (link == null || kept.size >= ENOUGH || read >= MAX_PAGES) return SearchPage(kept, link)
            page = try {
                next(link)
            } catch (e: LmeException) {
                if (kept.isEmpty() || e is LmeException.Cancelled) throw e
                return SearchPage(kept, link)
            }
            read++
        }
    }
}
