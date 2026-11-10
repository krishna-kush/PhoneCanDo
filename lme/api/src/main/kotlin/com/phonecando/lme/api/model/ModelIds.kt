package com.phonecando.lme.api.model

import com.phonecando.lme.api.LmeException

/**
 * Our model ids: words of `a-z` and `0-9` joined by single dashes, at most
 * [MAX_LENGTH] characters. An id is also the model's dir name and the model
 * name the server answers to, so it never holds a dot, a slash or a space.
 */
object ModelIds {
    const val MAX_LENGTH = 80
    private val GRAMMAR = Regex("[a-z0-9]+(-[a-z0-9]+)*")

    fun isValid(id: String): Boolean = id.length <= MAX_LENGTH && GRAMMAR.matches(id)

    /** [id] itself when valid. @throws LmeException.InvalidName otherwise. */
    fun check(id: String): String {
        if (!isValid(id)) throw LmeException.InvalidName(id, "a model id is a-z, 0-9 and single dashes, at most $MAX_LENGTH long")
        return id
    }
}
