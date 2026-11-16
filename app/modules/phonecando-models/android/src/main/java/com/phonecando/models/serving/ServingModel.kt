package com.phonecando.models.serving

import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.MeasuredMemory

/**
 * A model whose server answers now, the context it was started with, and
 * what it takes from free memory as its plan counted it at the start
 * ([heldBytes]: all but the file pages it reads in place, which are mapped
 * from storage).
 */
data class ServingModel(val modelId: String, val contextSize: Long, val heldBytes: Long)

/**
 * What the runner's model servers know (the runner sets it on ModelsHost:
 * it imports us; we never import it): which models they serve now (one
 * server per model; empty while none is ready), so a model's card shows the
 * context its server really runs with, not what a start would pick now
 * that the server itself takes memory; what a model's server measured of
 * itself on this phone; and whether its chats can be kept on storage.
 */
interface ServingSource {
  fun current(): List<ServingModel>

  /** What [record]'s server measured of itself on this phone and server build; null when it never did. */
  fun measured(record: ModelRecord): MeasuredMemory? = null

  /** Free bytes where [record]'s chats would be kept; null when they stay in RAM (saving them failed this run). */
  fun chatStorageFree(record: ModelRecord): Long? = null

  /** Measures [record] in the background when this phone never has (a download or import just finished). */
  fun measureSoon(record: ModelRecord) {}

  companion object {
    val NONE = object : ServingSource {
      override fun current(): List<ServingModel> = emptyList()
    }
  }
}
