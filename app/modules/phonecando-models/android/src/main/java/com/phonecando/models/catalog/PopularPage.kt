package com.phonecando.models.catalog

import com.phonecando.lme.catalog.SearchPage
import com.phonecando.lme.catalog.filters.ModelFilters

/**
 * The list the Models page opens on (no query, the default filters: the
 * most downloaded chat models), asked of the Hub once per process. Opening
 * the page again, or clearing a search, asks nothing; a failed request is
 * not kept. Any other query or filter goes to the Hub each time.
 */
internal class PopularPage {
  @Volatile
  private var kept: Pair<Int, SearchPage>? = null

  fun get(query: String, filters: ModelFilters, limit: Int, fetch: () -> SearchPage): SearchPage {
    if (query.isNotBlank() || filters != ModelFilters()) return fetch()
    kept?.takeIf { it.first == limit }?.let { return it.second }
    return fetch().also { kept = limit to it }
  }
}
