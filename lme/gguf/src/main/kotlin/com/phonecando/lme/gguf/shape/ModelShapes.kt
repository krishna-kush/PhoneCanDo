package com.phonecando.lme.gguf.shape

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.BaseModelRef
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.gguf.read.GgufHeader

/** A [GgufHeader] read as a language model llama.cpp can serve. Pure. */
object ModelShapes {
    /**
     * @throws LmeException.InvalidGguf when the file names no architecture or
     *   no layer count: not a language model (a vision projector, say)
     */
    fun of(header: GgufHeader): ModelShape {
        val arch = header.string("general.architecture")?.takeIf { it.isNotBlank() }
            ?: throw LmeException.InvalidGguf("no general.architecture")
        val layers = header.integer("$arch.block_count")
            ?: throw LmeException.InvalidGguf("no $arch.block_count: not a language model")
        return ModelShape(
            architecture = arch,
            name = header.string("general.name")?.trim()?.takeIf { it.isNotEmpty() },
            quant = header.integer("general.file_type")?.let(FileTypes::name),
            // The first part of a split model holds only some tensors (often none).
            parameterCount = header.parameterCount.takeIf { splitCount(header) <= 1 && it > 0 },
            contextLength = header.integer("$arch.context_length")?.takeIf { it > 0 },
            blockCount = layers,
            embeddingLength = header.integer("$arch.embedding_length")?.takeIf { it > 0 },
            kvCache = KvLayers.of(header, arch, layers),
            baseModel = baseModel(header),
        )
    }

    /** `general.base_model.0.*`, as llama.cpp's converter writes it from the model card; null when it names nothing. */
    private fun baseModel(header: GgufHeader): BaseModelRef? {
        fun text(key: String) = header.string("general.base_model.0.$key")?.trim()?.takeIf { it.isNotEmpty() }
        val ref = BaseModelRef(text("name"), text("organization"), text("repo_url"))
        return ref.takeIf { it.name != null || it.organization != null || it.repoUrl != null }
    }

    /** `split.count`: how many files the model is split into, 1 when it is not split. */
    fun splitCount(header: GgufHeader): Long = header.integer("split.count")?.takeIf { it > 0 } ?: 1
}
