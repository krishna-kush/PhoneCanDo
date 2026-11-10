package com.phonecando.models.api

import com.phonecando.lme.api.model.ModelDates
import java.time.DateTimeException
import java.time.LocalDate
import java.time.YearMonth

// A model's dates as JS reads them (ModelDates in app/src/engine/models/types.ts):
// { kind: 'released', released: 'YYYY-MM', cutoff: 'YYYY-MM' | null } or
// { kind: 'on_hub', since: 'YYYY-MM-DD' }.

internal fun datesMap(dates: ModelDates?): Map<String, Any?>? = when (dates) {
  null -> null
  is ModelDates.Released -> mapOf("kind" to "released", "released" to dates.released.toString(), "cutoff" to dates.cutoff?.toString())
  is ModelDates.OnHub -> mapOf("kind" to "on_hub", "since" to dates.since.toString())
}

/** What JS hands back with a download (as [datesMap] gave it); anything else is no dates, never a failed download. */
internal fun datesOf(raw: Any?): ModelDates? {
  val map = raw as? Map<*, *> ?: return null
  return try {
    when (map["kind"]) {
      "released" -> ModelDates.Released(YearMonth.parse(map["released"] as? String ?: return null), (map["cutoff"] as? String)?.let(YearMonth::parse))
      "on_hub" -> ModelDates.OnHub(LocalDate.parse(map["since"] as? String ?: return null))
      else -> null
    }
  } catch (_: DateTimeException) {
    null
  }
}
