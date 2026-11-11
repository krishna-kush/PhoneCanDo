package com.phonecando.models.serving

/** A model whose server answers now, and the context it was started with. */
data class ServingModel(val modelId: String, val contextSize: Long)

/**
 * Which models the runner's model servers serve now (one server per model;
 * empty while none is ready). The runner sets it on ModelsHost (it imports
 * us; we never import it), so a model's card shows the context its server
 * really runs with, not what a start would pick now that the server itself
 * takes memory.
 */
fun interface ServingSource {
  fun current(): List<ServingModel>

  companion object {
    val NONE = ServingSource { emptyList() }
  }
}
