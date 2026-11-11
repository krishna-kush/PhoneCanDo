package com.phonecando.lme.catalog.hub

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** One item of `GET /api/models` (search); [tags] hold `base_model:<repo>` and `base_model:<relation>:<repo>`. */
@Serializable
internal data class HitJson(
    val id: String = "",
    val downloads: Long = 0,
    val likes: Long = 0,
    @SerialName("pipeline_tag") val pipelineTag: String? = null,
    val createdAt: String? = null,
    val tags: List<String> = emptyList(),
)

/** `GET /api/models/{repo}/revision/{ref}?blobs=true`; `gated` is false or "auto" / "manual". */
@Serializable
internal data class RevisionJson(
    val id: String = "",
    val sha: String = "",
    val gated: JsonElement? = null,
    val cardData: CardDataJson? = null,
    val tags: List<String> = emptyList(),
    val createdAt: String? = null,
    val siblings: List<SiblingJson> = emptyList(),
)

/**
 * The model card's metadata, the parts we read: `base_model` is a string or
 * a list of repository ids, `base_model_relation` (rarely set: the Hub
 * infers it into the tags) one of `quantized`, `finetune`, `merge`,
 * `adapter`. Both are left loose, so an odd card costs its dates only.
 */
@Serializable
internal data class CardDataJson(
    @SerialName("base_model") val baseModel: JsonElement? = null,
    @SerialName("base_model_relation") val baseModelRelation: JsonElement? = null,
)

/**
 * `GET /api/models/{repo}?expand[]=createdAt&expand[]=safetensors`; the
 * `safetensors` field is left loose (`parameters.CheckpointSizes` reads
 * it), so an odd one costs the size only.
 */
@Serializable
internal data class OriginJson(val id: String = "", val createdAt: String? = null, val safetensors: JsonElement? = null)

/** One file of a revision, subfolders' included (`blobs=true` adds its size and, kept in LFS, its [lfs]). */
@Serializable
internal data class SiblingJson(val rfilename: String = "", val size: Long = -1, val lfs: LfsJson? = null)

/** LFS metadata of a file. */
@Serializable
internal data class LfsJson(val sha256: String = "", val size: Long = -1)
