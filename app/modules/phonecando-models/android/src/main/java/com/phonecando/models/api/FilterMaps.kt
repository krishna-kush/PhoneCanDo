package com.phonecando.models.api

import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelLicense
import com.phonecando.lme.catalog.filters.ModelSize
import com.phonecando.lme.catalog.filters.ModelSort

// The Hugging Face list's filters as JS sends them (ModelFilters in
// app/src/engine/models/types.ts): { sort, size?, license?, chatOnly }, a
// field left out when it is null. A value we do not know is a bug, refused.

private val SORTS = mapOf(
  "downloads" to ModelSort.DOWNLOADS,
  "trending" to ModelSort.TRENDING,
  "updated" to ModelSort.UPDATED,
  "likes" to ModelSort.LIKES,
)

private val SIZES = mapOf(
  "up_to_2b" to ModelSize.UP_TO_2B,
  "2b_to_5b" to ModelSize.FROM_2B_TO_5B,
  "5b_to_10b" to ModelSize.FROM_5B_TO_10B,
  "over_10b" to ModelSize.OVER_10B,
)

private val LICENSES = mapOf(
  "apache-2.0" to ModelLicense.APACHE_2_0,
  "mit" to ModelLicense.MIT,
)

internal fun filtersOf(raw: Map<String, Any?>): ModelFilters = ModelFilters(
  sort = pick(raw, "sort", SORTS) ?: ModelSort.DOWNLOADS,
  size = pick(raw, "size", SIZES),
  license = pick(raw, "license", LICENSES),
  chatOnly = raw["chatOnly"] as? Boolean ?: true,
)

private fun <T> pick(raw: Map<String, Any?>, name: String, values: Map<String, T>): T? {
  val value = raw[name] ?: return null
  return values[value] ?: throw IllegalArgumentException("unknown $name filter")
}
