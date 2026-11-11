package com.phonecando.lme.catalog.suggested

import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.catalog.RepoFile
import com.phonecando.lme.catalog.known.KnownModels
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * `suggested.json` (a resource beside [Suggested]) read strictly: an
 * unknown or missing field, or an origin [KnownModels] lacks, fails the
 * first use of [Suggested], and SuggestedTest with it.
 */
internal object SuggestedJson {
    /** Absolute, so it holds wherever the class ends up. */
    const val RESOURCE = "/com/phonecando/lme/catalog/suggested/suggested.json"

    class SuggestedList(val anyModel: PhoneRam, val models: List<SuggestedModel>)

    fun read(): SuggestedList {
        val text = SuggestedJson::class.java.getResourceAsStream(RESOURCE)?.use { it.readBytes().decodeToString() }
            ?: error("missing resource $RESOURCE")
        return decode(text)
    }

    fun decode(text: String): SuggestedList {
        val list = Json.decodeFromString<ListJson>(text)
        return SuggestedList(list.phoneRam.toPhoneRam(), list.models.map { it.toModel() })
    }

    @Serializable
    private class ListJson(
        @SerialName("\$comment") val comment: String,
        val phoneRam: PhoneRamJson,
        val models: List<ModelJson>,
    )

    @Serializable
    private class ModelJson(
        val title: String,
        val note: String,
        val repo: String,
        val origin: String,
        val revision: String,
        val file: FileJson,
        val contextLength: Long,
        val kvCache: KvCacheJson,
        val phoneRam: PhoneRamJson,
    ) {
        fun toModel() = SuggestedModel(
            title = title,
            note = note,
            repo = repo,
            origin = requireNotNull(KnownModels.of(origin)) { "$title: no known model $origin" },
            revision = revision,
            file = RepoFile(file.path, file.sizeBytes, file.sha256),
            contextLength = contextLength,
            kvCache = KvCacheShape(kvCache.fullPerToken, kvCache.windowPerToken, kvCache.slidingWindow),
            phoneRam = phoneRam.toPhoneRam(),
        )
    }

    @Serializable
    private class FileJson(val path: String, val sizeBytes: Long, val sha256: String)

    @Serializable
    private class KvCacheJson(val fullPerToken: Long, val windowPerToken: Long, val slidingWindow: Long?)

    @Serializable
    private class PhoneRamJson(val runsFromGb: Int, val runsWellFromGb: Int) {
        fun toPhoneRam() = PhoneRam(runsFromGb, runsWellFromGb)
    }
}
