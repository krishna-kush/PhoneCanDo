package com.phonecando.lme.store.registry

import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.store.download.PendingDownload

/** What `models.json` holds: the ready models and the downloads in flight. Ids are unique across both. */
internal data class Registry(val models: List<ModelRecord>, val downloads: List<PendingDownload>) {
    val ids: Set<String> get() = (models.map { it.id } + downloads.map { it.id }).toSet()

    fun model(id: String): ModelRecord? = models.firstOrNull { it.id == id }

    fun download(id: String): PendingDownload? = downloads.firstOrNull { it.id == id }

    fun withModel(record: ModelRecord) = copy(models = models.filter { it.id != record.id } + record)

    /** [record] in place of the model with its id, keeping the order. */
    fun replacing(record: ModelRecord) = copy(models = models.map { if (it.id == record.id) record else it })

    fun withDownload(pending: PendingDownload) = copy(downloads = downloads.filter { it.id != pending.id } + pending)

    fun without(id: String) = Registry(models.filter { it.id != id }, downloads.filter { it.id != id })

    companion object {
        val EMPTY = Registry(emptyList(), emptyList())
    }
}
