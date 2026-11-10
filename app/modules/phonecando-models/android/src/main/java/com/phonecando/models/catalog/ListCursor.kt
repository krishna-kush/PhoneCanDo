package com.phonecando.models.catalog

import com.phonecando.lme.catalog.filters.ModelSize

/**
 * The cursor JS holds for More: the Hub's next-page link, which keeps every
 * filter the Hub sees, and the size filter beside it, which the Hub never
 * sees (we match it, ListPages). Written as `<size> <link>`, `any` for no
 * size; a link never holds a raw space.
 */
internal data class ListCursor(val hub: String, val size: ModelSize?) {
  fun encode(): String = "${size?.name ?: ANY} $hub"

  companion object {
    private const val ANY = "any"

    /** A cursor [encode] wrote; anything else is a bug, refused. */
    fun parse(text: String): ListCursor {
      val head = text.substringBefore(' ', "")
      val hub = text.substringAfter(' ', "")
      require(head.isNotEmpty() && hub.isNotEmpty()) { "not a list cursor" }
      val size = if (head == ANY) null else ModelSize.entries.firstOrNull { it.name == head } ?: throw IllegalArgumentException("not a list cursor")
      return ListCursor(hub, size)
    }
  }
}
