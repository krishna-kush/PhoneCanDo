package com.phonecando.lme.store.registry

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.BaseModelRef
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelIds
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.store.download.PendingDownload
import com.phonecando.lme.store.download.RemoteFile
import com.phonecando.lme.store.layout.FileNames
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * `models.json` to and from a [Registry]. A file that is not exactly ours
 * (another version, a bad id or file name, a field missing) is
 * [LmeException.Corrupt]: we are pre-release and read no older shape. Pure.
 */
internal object RegistryCodec {
    const val VERSION = 3
    private const val WHAT = "models.json"
    private val JSON = Json { prettyPrint = true; ignoreUnknownKeys = false }

    fun encode(registry: Registry): String = JSON.encodeToString(
        RegistryJson.serializer(),
        RegistryJson(VERSION, registry.models.map(::model), registry.downloads.map(::download)),
    ) + "\n"

    fun decode(text: String): Registry {
        val doc = try {
            JSON.decodeFromString(RegistryJson.serializer(), text)
        } catch (e: SerializationException) {
            throw LmeException.Corrupt(WHAT, e)
        } catch (e: IllegalArgumentException) {
            throw LmeException.Corrupt(WHAT, e)
        }
        if (doc.version != VERSION) throw corrupt()
        val registry = try {
            Registry(doc.models.map(::model), doc.downloads.map(::download))
        } catch (e: IllegalArgumentException) {
            throw LmeException.Corrupt(WHAT, e)
        }
        val ids = registry.models.map { it.id } + registry.downloads.map { it.id }
        if (ids.size != ids.toSet().size) throw corrupt()
        return registry
    }

    private fun model(r: ModelRecord) = ModelJson(
        id = r.id,
        name = r.name,
        source = when (val s = r.source) {
            is ModelSource.HuggingFace -> SourceJson("huggingface", repo = s.repo, revision = s.revision)
            is ModelSource.Imported -> SourceJson("imported", fileName = s.fileName)
        },
        files = r.files.map { FileJson(it.name, it.sizeBytes, it.sha256) },
        shape = with(r.shape) {
            ShapeJson(
                architecture, name, quant, parameterCount, contextLength, blockCount, embeddingLength,
                kvCache.fullPerToken, kvCache.windowPerToken, kvCache.slidingWindow,
                baseModel?.let { BaseModelJson(it.name, it.organization, it.repoUrl) },
            )
        },
        addedAt = r.addedAtMillis,
        dates = r.dates?.let(DatesCodec::encode),
        context = r.context,
    )

    private fun model(j: ModelJson) = ModelRecord(
        id = id(j.id),
        name = j.name,
        source = when (j.source.kind) {
            "huggingface" -> ModelSource.HuggingFace(j.source.repo ?: throw corrupt(), j.source.revision ?: throw corrupt())
            "imported" -> ModelSource.Imported(j.source.fileName ?: throw corrupt())
            else -> throw corrupt()
        },
        files = j.files.map { ModelFile(name(it.name), it.size, it.sha256) },
        shape = with(j.shape) {
            ModelShape(
                architecture, name, quant, parameterCount, contextLength, blockCount, embeddingLength,
                KvCacheShape(kvFullPerToken, kvWindowPerToken, slidingWindow),
                baseModel?.let { BaseModelRef(it.name, it.organization, it.repoUrl) },
            )
        },
        addedAtMillis = j.addedAt,
        dates = j.dates?.let { DatesCodec.decode(it, WHAT) },
        context = j.context,
    )

    private fun download(p: PendingDownload) = DownloadJson(
        p.id, p.name, p.repo, p.revision, p.files.map { RemoteFileJson(it.name, it.url, it.sizeBytes, it.sha256) }, p.startedAtMillis,
        p.dates?.let(DatesCodec::encode),
    )

    private fun download(j: DownloadJson): PendingDownload {
        if (j.files.isEmpty()) throw corrupt()
        return PendingDownload(
            id(j.id), j.name, j.repo, j.revision, j.files.map { RemoteFile(name(it.name), it.url, it.size, it.sha256) }, j.startedAt,
            j.dates?.let { DatesCodec.decode(it, WHAT) },
        )
    }

    private fun id(id: String): String = if (ModelIds.isValid(id)) id else throw corrupt()

    private fun name(name: String): String = if (FileNames.isPlain(name)) name else throw corrupt()

    private fun corrupt() = LmeException.Corrupt(WHAT)
}
