package com.phonecando.lre.cli.report

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.cli.base.SourceInfo
import com.phonecando.lre.image.SetupResult
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Wall-clock milliseconds of the phases of one `setup`; [download] is 0 for a tarball. */
data class SetupTimings(val download: Long, val setup: Long)

/**
 * The one JSON line `setup` prints. Pure. Shape (null where SetupResult has null):
 *
 * `{"os":{"id","versionId","idLike":[],"prettyName","family","shell"}|null,
 *   "missingTools":[],"installCommand","socketPathTight",
 *   "source":{"kind":"registry","ref","manifestDigest","layers","bytes","sourceHost"}
 *          |{"kind":"tarball","path","bytes"},
 *   "timingsMs":{"download","setup"}}`
 *
 * `family` is the PackageFamily id (`apt`, `apk`, ...) or null when no known
 * package manager was found.
 */
object SetupJson {
    fun render(result: SetupResult, source: SourceInfo, timings: SetupTimings): String = buildJsonObject {
        put("os", result.os?.let(::os) ?: JsonNull)
        put("missingTools", strings(result.missingTools))
        put("installCommand", result.installCommand)
        put("socketPathTight", result.socketPathTight)
        put("source", source(source))
        put(
            "timingsMs",
            buildJsonObject {
                put("download", timings.download)
                put("setup", timings.setup)
            },
        )
    }.toString()

    private fun os(os: OsInfo): JsonElement = buildJsonObject {
        put("id", os.id)
        put("versionId", os.versionId)
        put("idLike", strings(os.idLike))
        put("prettyName", os.prettyName)
        put("family", os.family?.id)
        put("shell", os.shell)
    }

    private fun source(info: SourceInfo): JsonObject = buildJsonObject {
        when (info) {
            is SourceInfo.Registry -> {
                put("kind", "registry")
                put("ref", info.ref)
                put("manifestDigest", info.manifestDigest)
                put("layers", info.layers)
                put("bytes", info.bytes)
                put("sourceHost", info.sourceHost)
            }
            is SourceInfo.Tarball -> {
                put("kind", "tarball")
                put("path", info.path)
                put("bytes", info.bytes)
            }
        }
    }

    private fun strings(values: List<String>) = JsonArray(values.map(::JsonPrimitive))
}
