package com.phonecando.lme.store.registry

import kotlinx.serialization.Serializable

/** `models.json` on disk. [version] changes with any change of shape; we read only our own. */
@Serializable
internal data class RegistryJson(
    val version: Int,
    val models: List<ModelJson> = emptyList(),
    val downloads: List<DownloadJson> = emptyList(),
)

/** [context]: the context the user chose for it, in tokens; absent: automatic. */
@Serializable
internal data class ModelJson(
    val id: String,
    val name: String,
    val source: SourceJson,
    val files: List<FileJson>,
    val shape: ShapeJson,
    val addedAt: Long,
    val dates: DatesJson? = null,
    val context: Long? = null,
)

/** [kind] is `huggingface` (with [repo] and [revision]) or `imported` (with [fileName]). */
@Serializable
internal data class SourceJson(
    val kind: String,
    val repo: String? = null,
    val revision: String? = null,
    val fileName: String? = null,
)

@Serializable
internal data class FileJson(val name: String, val size: Long, val sha256: String)

@Serializable
internal data class ShapeJson(
    val architecture: String,
    val name: String? = null,
    val quant: String? = null,
    val parameterCount: Long? = null,
    val contextLength: Long? = null,
    val blockCount: Long,
    val embeddingLength: Long? = null,
    val kvFullPerToken: Long,
    val kvWindowPerToken: Long,
    val slidingWindow: Long? = null,
    val baseModel: BaseModelJson? = null,
)

@Serializable
internal data class BaseModelJson(val name: String? = null, val organization: String? = null, val repoUrl: String? = null)

/**
 * A model's dates: [kind] is `released` (with [released], `YYYY-MM`, and
 * [cutoff] when published) or `onHub` (with [since], `YYYY-MM-DD`).
 */
@Serializable
internal data class DatesJson(
    val kind: String,
    val released: String? = null,
    val cutoff: String? = null,
    val since: String? = null,
)

@Serializable
internal data class DownloadJson(
    val id: String,
    val name: String,
    val repo: String,
    val revision: String,
    val files: List<RemoteFileJson>,
    val startedAt: Long,
    val dates: DatesJson? = null,
)

@Serializable
internal data class RemoteFileJson(val name: String, val url: String, val size: Long, val sha256: String)
