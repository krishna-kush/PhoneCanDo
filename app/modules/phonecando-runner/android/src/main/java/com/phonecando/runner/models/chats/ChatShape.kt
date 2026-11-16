package com.phonecando.runner.models.chats

// What a saved chat holds to: a state saved by one server loads only into
// one of the same model file, context, KV cache type and checkpoints, from
// the same build (the server checks the sizes, not which model it was). A
// model's chat dir keeps the shape its files were saved with; a start with
// another deletes them all. Pure.
internal object ChatShape {
  fun of(
    modelId: String,
    entryName: String,
    sizeBytes: Long,
    context: Long,
    halfKvCache: Boolean,
    checkpoints: Int?,
    serverBytes: Long,
  ): String = listOf(
    "v1",
    "model=$modelId",
    "file=$entryName:$sizeBytes",
    "context=$context",
    "kv=${if (halfKvCache) "q8_0" else "f16"}",
    "checkpoints=${checkpoints ?: "none"}",
    "server=$serverBytes",
  ).joinToString("\n") + "\n"
}
