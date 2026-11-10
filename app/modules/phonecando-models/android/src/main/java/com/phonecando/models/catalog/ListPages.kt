package com.phonecando.models.catalog

import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.SearchPage
import com.phonecando.lme.catalog.filters.ListFill
import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelSize

/**
 * The Hugging Face list's pages as the Models page shows them. The Hub
 * cannot keep to a size, so under a size filter we read its pages (lme's
 * ListFill: at most three per list or More) and keep the repositories whose
 * size we know and that match it; [HubOrigins] looks up the originals that
 * only their checkpoint can size. The `next` of a page is a [ListCursor].
 */
internal class ListPages(private val origins: HubOrigins) {
  fun first(hub: HfCatalog, query: String, filters: ModelFilters, limit: Int): SearchPage =
    fill(hub, hub.search(query, filters, ListFill.hubLimit(filters, limit)), filters.size)

  fun next(hub: HfCatalog, cursor: String): SearchPage {
    val at = ListCursor.parse(cursor)
    return fill(hub, hub.nextPage(at.hub), at.size)
  }

  private fun fill(hub: HfCatalog, first: SearchPage, size: ModelSize?): SearchPage {
    val page = ListFill.fill(first, hub::nextPage) { hits -> keep(hub, hits, size) }
    return SearchPage(page.hits, page.next?.let { ListCursor(it, size).encode() })
  }

  private fun keep(hub: HfCatalog, hits: List<ModelHit>, size: ModelSize?): List<ModelHit> {
    if (size == null) return hits
    origins.lookUpSizes(hub, hits)
    return hits.filter { size.holds(origins.size(it)) }
  }
}
