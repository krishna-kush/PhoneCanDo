package com.phonecando.lme.api.model

import java.time.LocalDate
import java.time.YearMonth

/**
 * When a model came out and how recent its training data is, as far as we
 * can say without guessing. Only a model we know (`KnownModels` in
 * lme-catalog) has a release month and a cutoff; any other model has the
 * day its original repository was created on Hugging Face, which can be
 * before its public release.
 */
sealed interface ModelDates {
    /** The vendor's own release month and training-data cutoff; [cutoff] is null when the vendor publishes none. */
    data class Released(val released: YearMonth, val cutoff: YearMonth?) : ModelDates

    /** The day (UTC) the original model's repository was created on Hugging Face. */
    data class OnHub(val since: LocalDate) : ModelDates
}
