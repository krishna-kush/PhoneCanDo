package com.phonecando.pce.api

/**
 * Marks public PCE API that may change before 1.0. Opt in explicitly with
 * `@OptIn(ExperimentalPceApi::class)`; do not treat it as a stable contract.
 */
@RequiresOptIn(
    message = "This PCE API is experimental and may change before 1.0.",
    level = RequiresOptIn.Level.ERROR,
)
@Retention(AnnotationRetention.BINARY)
// Fully qualified: this package also declares Target.
@kotlin.annotation.Target(
    AnnotationTarget.CLASS,
    AnnotationTarget.FUNCTION,
    AnnotationTarget.PROPERTY,
    AnnotationTarget.TYPEALIAS,
)
@MustBeDocumented
annotation class ExperimentalPceApi
