package com.phonecando.models.catalog

import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.store.download.PendingDownload

/**
 * Which model on the phone, or pending download, a catalog file already is:
 * matched by its sha256, the one name a file cannot fake. Pure.
 */
class LocalMatch(models: List<ModelRecord>, downloads: List<PendingDownload>) {
  private val modelBySha = models.flatMap { m -> m.files.map { it.sha256 to m.id } }.toMap()
  private val downloadBySha = downloads.flatMap { d -> d.files.map { it.sha256 to d.id } }.toMap()

  /** The ready model with a file of [sha256]; null when none. */
  fun model(sha256: String?): String? = sha256?.let(modelBySha::get)

  /** The pending download with a file of [sha256]; null when none. */
  fun download(sha256: String?): String? = sha256?.let(downloadBySha::get)
}
