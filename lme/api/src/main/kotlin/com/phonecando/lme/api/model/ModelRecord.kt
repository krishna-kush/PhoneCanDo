package com.phonecando.lme.api.model

/**
 * One model on the phone, ready to serve: every file is complete and
 * verified. [files] are in load order; the runtime opens [entry] and finds
 * a split model's other parts next to it by name.
 *
 * @property name the display name: the GGUF `general.name`, else the file name
 * @property dates what the catalog knew when it was downloaded; null for an
 *   import, and when the catalog knew nothing
 * @property context the context it is served with, in tokens, as the user
 *   chose it; null: automatic (the runtime picks it for the phone at each
 *   start)
 */
data class ModelRecord(
    val id: String,
    val name: String,
    val source: ModelSource,
    val files: List<ModelFile>,
    val shape: ModelShape,
    val addedAtMillis: Long,
    val dates: ModelDates? = null,
    val context: Long? = null,
) {
    init {
        require(files.isNotEmpty()) { "a model has at least one file" }
        require(context == null || context >= 1) { "a context of at least one token" }
    }

    val entry: ModelFile get() = files.first()

    val sizeBytes: Long get() = files.sumOf { it.sizeBytes }
}
