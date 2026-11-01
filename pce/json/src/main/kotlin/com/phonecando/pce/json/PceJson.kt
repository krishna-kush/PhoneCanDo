package com.phonecando.pce.json

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot
import kotlinx.serialization.json.Json

/**
 * Optional JSON codec for the PCE contract. The API module stays free of
 * serialization annotations; hosts that need JSON depend on `pce-json`.
 */
object PceJson {
    private val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = true
    }
    private val strictJson = Json {
        encodeDefaults = true
        ignoreUnknownKeys = false
    }

    fun encodeSnapshot(snapshot: Snapshot): String =
        json.encodeToString(SnapshotDto.serializer(), snapshot.toDto())

    fun decodeSnapshot(text: String): PceResult<Snapshot> =
        decode(ErrorCode.INVALID_SNAPSHOT) {
            json.decodeFromString(SnapshotDto.serializer(), text).toApi()
        }

    fun encodeSelector(selector: Selector): String =
        json.encodeToString(SelectorDto.serializer(), selector.toDto())

    fun decodeSelector(text: String): PceResult<Selector> =
        decode(ErrorCode.INVALID_SELECTOR) {
            json.decodeFromString(SelectorDto.serializer(), text).toApi()
        }

    /** Like [decodeSelector], but rejects unknown fields. */
    fun decodeSelectorStrict(text: String): PceResult<Selector> =
        decode(ErrorCode.INVALID_SELECTOR) {
            strictJson.decodeFromString(SelectorDto.serializer(), text).toApi()
        }

    fun encodeAction(action: Action): String =
        json.encodeToString(ActionDto.serializer(), action.toDto())

    fun decodeAction(text: String): PceResult<Action> =
        decode(ErrorCode.INVALID_ACTION) {
            json.decodeFromString(ActionDto.serializer(), text).toApi()
        }

    /** Like [decodeAction], but rejects unknown fields. */
    fun decodeActionStrict(text: String): PceResult<Action> =
        decode(ErrorCode.INVALID_ACTION) {
            strictJson.decodeFromString(ActionDto.serializer(), text).toApi()
        }

    fun encodeError(error: PceError): String =
        json.encodeToString(ErrorDto.serializer(), error.toDto())

    fun decodeError(text: String): PceResult<PceError> =
        decode(ErrorCode.INTERNAL) {
            json.decodeFromString(ErrorDto.serializer(), text).toApi()
        }

    private inline fun <T> decode(code: ErrorCode, block: () -> T): PceResult<T> =
        try {
            PceResult.Ok(block())
        } catch (failure: Exception) {
            PceResult.Err(
                PceError(
                    code = code,
                    message = failure.message ?: "Invalid PCE JSON",
                    recovery = Recovery("json", "Send a value produced by PceJson"),
                )
            )
        }
}
