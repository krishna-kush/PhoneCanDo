package com.phonecando.lme.store

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.ProgressSink
import com.phonecando.lme.api.http.HttpPort
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelIds
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.store.check.HeaderCheck
import com.phonecando.lme.store.download.DownloadRequest
import com.phonecando.lme.store.download.FileDownloader
import com.phonecando.lme.store.download.PendingDownload
import com.phonecando.lme.store.ids.IdMaker
import com.phonecando.lme.store.imports.ModelImport
import com.phonecando.lme.store.io.AtomicFile
import com.phonecando.lme.store.io.FreeSpace
import com.phonecando.lme.store.io.TreeDelete
import com.phonecando.lme.store.layout.FileNames
import com.phonecando.lme.store.layout.ModelLayout
import com.phonecando.lme.store.registry.ModelRegistry
import java.io.File
import java.io.IOException
import java.io.InputStream

/**
 * The models on the phone (see [ModelLayout]): download from a URL with
 * resume, import from a stream, list, delete. A file becomes part of a model
 * only after its size, sha256 and GGUF header check out. Blocking; one
 * instance per models dir; the host runs one job per model at a time.
 *
 * HTTP goes through [http]; a Hugging Face token passed to [download] is
 * sent to [ModelSource.HuggingFace.ORIGIN] only and never stored.
 */
class ModelStore(
    val layout: ModelLayout,
    private val http: HttpPort,
    private val freeSpace: FreeSpace = FreeSpace.FILE_SYSTEM,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val registry = ModelRegistry(layout.registry)

    fun models(): List<ModelRecord> = registry.read().models

    fun downloads(): List<PendingDownload> = registry.read().downloads

    /** The file the runtime opens for [record]. */
    fun entryFile(record: ModelRecord): File = layout.file(record.id, record.entry.name)

    /** Bytes of [pending] already on disk, verified or not: its progress after a restart. */
    fun bytesOnDisk(pending: PendingDownload): Long = pending.files.sumOf { f ->
        val done = layout.file(pending.id, f.name)
        if (done.isFile) done.length() else layout.part(pending.id, f.name).length()
    }

    /**
     * Registers [request] as a download under a new id and returns it; run
     * it with [download]. The same request still pending comes back as it is.
     *
     * @throws LmeException.Exists when that model is already here
     * @throws LmeException.NoSpace when its files would not fit
     */
    fun startDownload(request: DownloadRequest): PendingDownload {
        require(request.files.isNotEmpty()) { "a download has at least one file" }
        for (file in request.files) {
            FileNames.check(file.name)
            // The catalog's values; anything else would only fail after the whole download.
            require(file.sizeBytes >= 0 && SHA256.matches(file.sha256)) { "${file.name}: no size or lower-case sha256" }
        }
        var started: PendingDownload? = null
        registry.update { current ->
            current.downloads.firstOrNull { it.repo == request.repo && it.revision == request.revision && it.files == request.files }
                ?.let { started = it; return@update current }
            current.models.firstOrNull { sameModel(it, request) }?.let { throw LmeException.Exists(it.id) }
            val first = request.files.first().name
            val pending = PendingDownload(
                IdMaker.unique(first, current.ids + diskNames()), IdMaker.stem(first), request.repo, request.revision,
                request.files, clock(), request.dates,
            )
            checkSpace(pending.sizeBytes)
            started = pending
            current.withDownload(pending)
        }
        return started!!
    }

    /**
     * Runs or resumes the download [id] to the end: every file fetched and
     * verified, the header checked, the model registered and returned.
     * Network errors keep what arrived for the next call; a file that fails
     * its checks is deleted; a model that fails its header check is removed
     * with its download.
     */
    fun download(id: String, token: String? = null, sink: ProgressSink = ProgressSink.NONE, cancel: CancelSignal = CancelSignal.NEVER): ModelRecord {
        val pending = registry.read().download(id) ?: throw LmeException.NotFound("download $id")
        makeDir(layout.dir(id))
        checkSpace(pending.sizeBytes - bytesOnDisk(pending))
        val total = pending.sizeBytes
        var base = 0L
        for (file in pending.files) {
            val target = layout.file(id, file.name)
            // A file under its final name was verified before the rename.
            if (!(target.isFile && target.length() == file.sizeBytes)) {
                FileDownloader(http, headersFor(file.url, token)).download(file, layout.part(id, file.name), target, base, total, sink, cancel)
            }
            base += file.sizeBytes
        }
        val shape = try {
            HeaderCheck.shape(layout.file(id, pending.files.first().name), pending.files.size)
        } catch (e: LmeException) {
            if (e !is LmeException.InvalidGguf && e !is LmeException.TooLarge) throw e
            registry.update { it.without(id) }
            TreeDelete.delete(layout.dir(id).toPath())
            throw e
        }
        val record = ModelRecord(
            id = id,
            name = shape.name ?: pending.name,
            source = ModelSource.HuggingFace(pending.repo, pending.revision),
            files = pending.files.map { ModelFile(it.name, it.sizeBytes, it.sha256) },
            shape = shape,
            addedAtMillis = clock(),
            dates = pending.dates,
        )
        registry.update {
            // Deleted while we ran: the files are gone too, so there is no model.
            if (it.download(id) == null) throw LmeException.NotFound("download $id")
            it.without(id).withModel(record)
        }
        return record
    }

    /**
     * Copies a model in from [input] (the system file picker's stream) and
     * registers it. [fileName] is the name the picker showed; [sizeHint],
     * when the picker knows it, is checked for space first and for a
     * complete copy after. Only a whole, unsplit GGUF model is taken; on any
     * failure nothing of it stays.
     */
    fun import(
        input: InputStream,
        fileName: String,
        sizeHint: Long? = null,
        sink: ProgressSink = ProgressSink.NONE,
        cancel: CancelSignal = CancelSignal.NEVER,
    ): ModelRecord {
        if (sizeHint != null) checkSpace(sizeHint)
        // Reserve the id with its dir, under the registry's lock: a download
        // or import starting at the same time sees the dir and picks another.
        var reserved = ""
        registry.update { current ->
            reserved = IdMaker.unique(fileName, current.ids + diskNames())
            makeDir(layout.dir(reserved))
            current
        }
        val id = reserved
        val name = "$id.gguf"
        val part = layout.part(id, name)
        val target = layout.file(id, name)
        try {
            val copied = ModelImport.copy(input, part, sizeHint, sink, cancel)
            val shape = HeaderCheck.shape(part, parts = 1)
            AtomicFile.moveSynced(part, target)
            val record = ModelRecord(
                id = id,
                name = shape.name ?: IdMaker.stem(fileName).ifBlank { id },
                source = ModelSource.Imported(fileName),
                files = listOf(ModelFile(name, copied.sizeBytes, copied.sha256)),
                shape = shape,
                addedAtMillis = clock(),
            )
            registry.update { it.withModel(record) }
            return record
        } catch (e: Throwable) {
            TreeDelete.delete(layout.dir(id).toPath())
            throw e
        }
    }

    /**
     * Sets the context model [id] is served with: [context] tokens, at most
     * its trained context when its header names one; null for automatic.
     * Returns the record as saved. A running server keeps its own until it
     * starts again.
     *
     * @throws LmeException.NotFound when no such model is here
     */
    fun setContext(id: String, context: Long?): ModelRecord {
        require(context == null || context >= 1) { "a context of at least one token" }
        var saved: ModelRecord? = null
        registry.update { current ->
            val record = current.model(id) ?: throw LmeException.NotFound("model $id")
            val trained = record.shape.contextLength
            require(context == null || trained == null || context <= trained) { "more context than ${record.name} was trained for" }
            val updated = record.copy(context = context)
            saved = updated
            current.replacing(updated)
        }
        return saved!!
    }

    /** Removes model or download [id] and its files. Stop a server using it first. */
    fun delete(id: String) {
        ModelIds.check(id)
        registry.update { it.without(id) }
        TreeDelete.delete(layout.dir(id).toPath())
    }

    /**
     * Deletes dirs under the models dir that no model or download owns:
     * what an import killed mid-copy leaves. Call once at start, before any
     * job runs.
     */
    fun sweep() {
        val ids = registry.read().ids
        layout.root.listFiles().orEmpty()
            .filter { ModelIds.isValid(it.name) && it.name !in ids }
            .forEach { TreeDelete.delete(it.toPath()) }
    }

    private fun sameModel(record: ModelRecord, request: DownloadRequest): Boolean {
        val source = record.source as? ModelSource.HuggingFace ?: return false
        return source.repo == request.repo && source.revision == request.revision &&
            record.files.map { it.name to it.sha256 } == request.files.map { it.name to it.sha256 }
    }

    private fun diskNames(): Set<String> = layout.root.list()?.toSet().orEmpty()

    private fun checkSpace(needed: Long) {
        if (needed <= 0) return
        val free = freeSpace.bytes(layout.root)
        if (needed + SPACE_MARGIN > free) throw LmeException.NoSpace(needed + SPACE_MARGIN, free)
    }

    private fun headersFor(url: String, token: String?): Map<String, String> =
        if (token.isNullOrBlank() || !url.startsWith(ModelSource.HuggingFace.ORIGIN + "/")) {
            emptyMap()
        } else {
            mapOf("Authorization" to "Bearer $token")
        }

    private fun makeDir(dir: File) {
        if (!dir.isDirectory && !dir.mkdirs() && !dir.isDirectory) throw IOException("cannot create ${dir.name}")
    }

    companion object {
        /** Left free on top of a model's files, so the phone never runs out of storage because of us. */
        const val SPACE_MARGIN = 256L shl 20

        private val SHA256 = Regex("[0-9a-f]{64}")
    }
}
