package com.phonecando.lme.store.download

import com.phonecando.lme.api.model.ModelDates

/**
 * One file to fetch: its name in the model's dir (a split part keeps its
 * `-0000N-of-0000M` name), where it downloads from, and the size and sha256
 * it must have.
 */
data class RemoteFile(val name: String, val url: String, val sizeBytes: Long, val sha256: String)

/**
 * A model to download, as the catalog found it: [repo] at commit
 * [revision], [files] in load order, and the [dates] the catalog knew,
 * kept with the model so they show offline.
 */
data class DownloadRequest(val repo: String, val revision: String, val files: List<RemoteFile>, val dates: ModelDates? = null)

/** A download in flight or interrupted; [com.phonecando.lme.store.ModelStore.download] resumes it by [id]. */
data class PendingDownload(
    val id: String,
    val name: String,
    val repo: String,
    val revision: String,
    val files: List<RemoteFile>,
    val startedAtMillis: Long,
    val dates: ModelDates? = null,
) {
    val sizeBytes: Long get() = files.sumOf { it.sizeBytes }
}
