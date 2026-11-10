package com.phonecando.lme.host.context

/**
 * The contexts a model may be served with, in tokens: from [min] (the
 * floor, [ContextSizing.FLOOR], or the trained context when that is less)
 * to [max] (the trained context). A model whose trained context is unknown
 * gets the floor only. Pure.
 */
data class ContextRange(val min: Long, val max: Long) {
    init {
        require(min in 1..max) { "a range of at least one token, smallest first" }
    }

    operator fun contains(context: Long): Boolean = context in min..max

    fun coerce(context: Long): Long = context.coerceIn(min, max)

    companion object {
        /** The range for a model trained for [trained] tokens (null: unknown). */
        fun of(trained: Long?): ContextRange {
            val floor = minOf(ContextSizing.FLOOR, trained ?: ContextSizing.FLOOR)
            return ContextRange(floor, trained ?: floor)
        }
    }
}
