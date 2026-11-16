package com.phonecando.lme.store.measured

import com.phonecando.lme.api.serve.MeasuredMemory
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * A model's `.memory.json` to and from a [MeasuredMemory]. A file that is
 * not exactly ours reads as none: the next start measures again. Pure.
 */
internal object MeasuredCodec {
    const val VERSION = 1
    private val JSON = Json { prettyPrint = true; ignoreUnknownKeys = false }

    fun encode(m: MeasuredMemory): String = JSON.encodeToString(
        MeasuredJson.serializer(),
        MeasuredJson(VERSION, m.phone, m.context, m.halfKvCache, m.mappedBytes, m.copiedBytes, m.stateBytes, m.computeBytes),
    ) + "\n"

    fun decode(text: String): MeasuredMemory? {
        val doc = try {
            JSON.decodeFromString(MeasuredJson.serializer(), text)
        } catch (_: SerializationException) {
            return null
        } catch (_: IllegalArgumentException) {
            return null
        }
        if (doc.version != VERSION) return null
        return try {
            MeasuredMemory(doc.phone, doc.context, doc.halfKvCache, doc.mappedBytes, doc.copiedBytes, doc.stateBytes, doc.computeBytes)
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}
