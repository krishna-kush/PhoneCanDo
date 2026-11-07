package com.phonecando.lre.cli.report

import com.phonecando.lre.api.LreException

/** Stable error codes for scripts: the LreException subclass name in snake_case. Pure. */
object ErrorCode {
    /** `NoArm64` -> `no_arm64`, `InvalidRef` -> `invalid_ref`, `NotFound` -> `not_found`. */
    fun of(e: LreException): String = snake(e.javaClass.simpleName)

    /** The line we print on stderr for [e]. */
    fun line(e: LreException): String = "${of(e)}: ${e.message}"

    fun snake(name: String): String = buildString {
        name.forEachIndexed { i, c ->
            val prev = name.getOrNull(i - 1)
            val next = name.getOrNull(i + 1)
            val boundary = c.isUpperCase() && prev != null &&
                (prev.isLowerCase() || prev.isDigit() || (prev.isUpperCase() && next?.isLowerCase() == true))
            if (boundary) append('_')
            append(c.lowercaseChar())
        }
    }
}
