package com.phonecando.lme.store.registry

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.ModelDates
import java.time.DateTimeException
import java.time.LocalDate
import java.time.YearMonth

/** A model's [ModelDates] in `models.json`; anything else is [LmeException.Corrupt]. Pure. */
internal object DatesCodec {
    private const val RELEASED = "released"
    private const val ON_HUB = "onHub"

    fun encode(dates: ModelDates): DatesJson = when (dates) {
        is ModelDates.Released -> DatesJson(RELEASED, released = dates.released.toString(), cutoff = dates.cutoff?.toString())
        is ModelDates.OnHub -> DatesJson(ON_HUB, since = dates.since.toString())
    }

    fun decode(json: DatesJson, what: String): ModelDates = try {
        when (json.kind) {
            RELEASED -> ModelDates.Released(YearMonth.parse(json.released ?: throw corrupt(what)), json.cutoff?.let(YearMonth::parse))
            ON_HUB -> ModelDates.OnHub(LocalDate.parse(json.since ?: throw corrupt(what)))
            else -> throw corrupt(what)
        }
    } catch (e: DateTimeException) {
        throw LmeException.Corrupt(what, e)
    }

    private fun corrupt(what: String) = LmeException.Corrupt(what)
}
