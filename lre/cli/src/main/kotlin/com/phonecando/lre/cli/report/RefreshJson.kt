package com.phonecando.lre.cli.report

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** The JSON line `refresh` prints: `{"imageDir","timingsMs":{"refresh"}}`. Pure. */
object RefreshJson {
    fun render(imageDir: String, refreshMillis: Long): String = buildJsonObject {
        put("imageDir", imageDir)
        put("timingsMs", buildJsonObject { put("refresh", refreshMillis) })
    }.toString()
}
