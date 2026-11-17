package com.phonecando.lme.store.check

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.lmeNet
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.network.download.RangeOpener
import java.io.IOException

/**
 * A remote model file's GGUF header, checked before a byte of it is kept:
 * a file that is no model we can serve fails in the first megabytes, not
 * after the whole download.
 */
internal object HeaderPeek {
    /**
     * Reads the header of the file [opener] serves (the first of [parts]),
     * then drops the connection: the rest of the body is never read.
     *
     * @throws LmeException.InvalidGguf when it is not a model llama.cpp can serve
     * @throws LmeException.TooLarge when its header passes our limits
     */
    fun shape(opener: RangeOpener, parts: Int): ModelShape {
        val response = lmeNet { opener.open(0) }
        try {
            if (response.status !in 200..299) throw LmeException.Network(opener.where, response.status)
            return HeaderCheck.shape(response.body, parts)
        } catch (e: IOException) {
            throw LmeException.Network(opener.where, null, e)
        } finally {
            response.abort()
        }
    }
}
