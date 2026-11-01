package com.phonecando.pce.api

enum class ErrorCode {
    STALE_SNAPSHOT,
    NOT_FOUND,
    AMBIGUOUS,
    INVALID_SELECTOR,
    INVALID_SNAPSHOT,
    INVALID_ACTION,
    NOT_VISIBLE,
    NOT_EDITABLE,
    UNSUPPORTED_ACTION,
    INVALID_PACK,
    PACK_SIGNATURE_INVALID,
    PACK_INCOMPATIBLE,
    BACKEND_UNAVAILABLE,
    TIMEOUT,
    CANCELLED,
    ASSERTION_FAILED,
    INTERNAL,
}

/** A machine-readable next step for an AI or caller. */
data class Recovery(val action: String, val hint: String? = null)

/**
 * Expected PCE failure. Do not throw for these; return them through
 * [PceResult.Err] so callers can branch and trace them.
 */
data class PceError(
    val code: ErrorCode,
    val message: String,
    val recovery: Recovery? = null,
    val candidates: List<NodeId> = emptyList(),
)

sealed interface PceResult<out T> {
    data class Ok<T>(val value: T) : PceResult<T>
    data class Err(val error: PceError) : PceResult<Nothing>
}

inline fun <T, R> PceResult<T>.map(transform: (T) -> R): PceResult<R> = when (this) {
    is PceResult.Ok -> PceResult.Ok(transform(value))
    is PceResult.Err -> this
}

/** Convenience for samples/tests only. Pce code must branch on Err. */
fun <T> PceResult<T>.getOrThrow(): T = when (this) {
    is PceResult.Ok -> value
    is PceResult.Err -> throw IllegalStateException("${error.code}: ${error.message}")
}
