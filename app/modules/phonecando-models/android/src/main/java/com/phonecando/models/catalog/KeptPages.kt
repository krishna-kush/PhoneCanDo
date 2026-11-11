package com.phonecando.models.catalog

import com.phonecando.lme.catalog.SearchPage
import com.phonecando.lme.catalog.filters.ModelFilters

/**
 * The Hugging Face list's pages as we last read them, kept for the process:
 * the list the page opens on, a search typed again, a filter set back and a
 * More already read ask nothing. The [MAX] most recently used are kept; a
 * failed request is not. Saving or clearing the token forgets them all
 * ([clear]): it can change what the Hub lists.
 */
internal class KeptPages {
  /** A list's first page. */
  data class First(val query: String, val filters: ModelFilters, val limit: Int)

  /** The page after one, by its cursor (a ListCursor). */
  data class Next(val cursor: String)

  private val pages = object : LinkedHashMap<Any, SearchPage>(16, 0.75f, true) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Any, SearchPage>): Boolean = size > MAX
  }

  /** The page for [key] as kept, else [fetch]'s, kept. */
  fun get(key: Any, fetch: () -> SearchPage): SearchPage {
    synchronized(pages) { pages[key] }?.let { return it }
    return fetch().also { page -> synchronized(pages) { pages[key] = page } }
  }

  fun clear() = synchronized(pages) { pages.clear() }

  private companion object {
    const val MAX = 24
  }
}
