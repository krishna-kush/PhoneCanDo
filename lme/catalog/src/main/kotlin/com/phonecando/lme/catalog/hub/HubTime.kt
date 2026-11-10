package com.phonecando.lme.catalog.hub

import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** The Hub's timestamps (`2026-03-02T05:46:32.000Z`). Pure. */
internal object HubTime {
    /** The UTC day of [text]; null when it is missing or not a timestamp, which costs a model its dates only. */
    fun day(text: String?): LocalDate? = try {
        text?.let { Instant.parse(it).atOffset(ZoneOffset.UTC).toLocalDate() }
    } catch (_: DateTimeException) {
        null
    }
}
