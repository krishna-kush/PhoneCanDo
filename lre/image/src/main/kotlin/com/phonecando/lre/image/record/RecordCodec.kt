package com.phonecando.lre.image.record

import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily
import com.phonecando.lre.image.detect.Detection

/**
 * `run/image.properties`: `key=value` lines, a repeated key for a list,
 * backslash escapes for `\`, line feed and carriage return. Pure.
 */
internal object RecordCodec {
    fun encode(record: ImageRecord): String {
        val out = ArrayList<Pair<String, String>>()
        when (record) {
            ImageRecord.Android -> out += "kind" to "android"
            is ImageRecord.Linux -> {
                val d = record.detection
                out += "kind" to "linux"
                out += "os.id" to d.os.id
                d.os.versionId?.let { out += "os.versionId" to it }
                d.os.idLike.forEach { out += "os.idLike" to it }
                d.os.prettyName?.let { out += "os.prettyName" to it }
                d.os.family?.let { out += "os.family" to it.id }
                d.os.shell?.let { out += "os.shell" to it }
                out += "hasBash" to d.hasBash.toString()
                out += "hasSh" to d.hasSh.toString()
                d.busyboxSh?.let { out += "busyboxSh" to it }
                d.config?.let { c ->
                    out += "config" to "present"
                    c.env.forEach { out += "config.env" to it }
                    c.workingDir?.let { out += "config.workingDir" to it }
                    c.user?.let { out += "config.user" to it }
                    c.entrypoint.forEach { out += "config.entrypoint" to it }
                    c.cmd.forEach { out += "config.cmd" to it }
                }
            }
        }
        return out.joinToString("") { (key, value) -> "$key=${escape(value)}\n" }
    }

    /** @throws LreException.Corrupt when the text is not a record we wrote. */
    fun decode(text: String): ImageRecord {
        val values = LinkedHashMap<String, MutableList<String>>()
        for (line in text.lineSequence()) {
            if (line.isEmpty()) continue
            val eq = line.indexOf('=')
            if (eq <= 0) throw corrupt()
            values.getOrPut(line.substring(0, eq)) { ArrayList() } += unescape(line.substring(eq + 1))
        }
        fun one(key: String) = values[key]?.lastOrNull()
        fun all(key: String) = values[key].orEmpty().toList()
        return when (one("kind")) {
            "android" -> ImageRecord.Android
            "linux" -> {
                val family = one("os.family")?.let { id -> PackageFamily.entries.firstOrNull { it.id == id } ?: throw corrupt() }
                val os = OsInfo(
                    id = one("os.id") ?: throw corrupt(),
                    versionId = one("os.versionId"),
                    idLike = all("os.idLike"),
                    prettyName = one("os.prettyName"),
                    family = family,
                    shell = one("os.shell") ?: throw corrupt(),
                )
                val config = one("config")?.let {
                    ImageConfig(
                        env = all("config.env"),
                        workingDir = one("config.workingDir"),
                        user = one("config.user"),
                        entrypoint = all("config.entrypoint"),
                        cmd = all("config.cmd"),
                    )
                }
                ImageRecord.Linux(
                    Detection(
                        os = os,
                        config = config,
                        hasBash = one("hasBash") == "true",
                        hasSh = one("hasSh") == "true",
                        busyboxSh = one("busyboxSh"),
                    ),
                )
            }
            else -> throw corrupt()
        }
    }

    private fun corrupt() = LreException.Corrupt("run/image.properties")

    private fun escape(value: String): String = buildString {
        for (c in value) {
            when (c) {
                '\\' -> append("\\\\")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                else -> append(c)
            }
        }
    }

    private fun unescape(value: String): String = buildString {
        var i = 0
        while (i < value.length) {
            val c = value[i]
            if (c == '\\' && i + 1 < value.length) {
                when (val next = value[i + 1]) {
                    'n' -> append('\n')
                    'r' -> append('\r')
                    else -> append(next)
                }
                i += 2
            } else {
                append(c)
                i++
            }
        }
    }
}
