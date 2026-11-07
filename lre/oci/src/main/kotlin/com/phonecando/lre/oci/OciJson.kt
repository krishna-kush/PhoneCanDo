package com.phonecando.lre.oci

import com.phonecando.lre.api.LreException
import kotlinx.serialization.json.Json

/** Our one JSON reader: registry and Hub responses carry many fields we skip. */
internal val ociJson: Json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
}

/** Decodes untrusted [bytes]; anything malformed is [LreException.Corrupt] naming [what]. */
internal inline fun <reified T> decodeOrCorrupt(bytes: ByteArray, what: String): T = try {
    ociJson.decodeFromString<T>(bytes.decodeToString())
} catch (e: IllegalArgumentException) {
    // SerializationException is an IllegalArgumentException.
    throw LreException.Corrupt(what, e)
}
