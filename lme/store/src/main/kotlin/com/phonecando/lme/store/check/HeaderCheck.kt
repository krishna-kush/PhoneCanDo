package com.phonecando.lme.store.check

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.gguf.read.GgufReader
import com.phonecando.lme.gguf.shape.ModelShapes
import java.io.File

/** A model file's GGUF header, read and checked before the file becomes a model. */
internal object HeaderCheck {
    /**
     * The shape of the model whose first file is [file], made of [parts]
     * files in all.
     *
     * @throws LmeException.InvalidGguf when it is not a model llama.cpp can
     *   serve, or its `split.count` does not match [parts]
     */
    fun shape(file: File, parts: Int): ModelShape {
        val header = file.inputStream().use { GgufReader.read(it) }
        val split = ModelShapes.splitCount(header)
        if (split != parts.toLong()) {
            throw LmeException.InvalidGguf(
                if (parts == 1) "one part of a model split into $split files" else "split into $split files, not $parts",
            )
        }
        return ModelShapes.of(header)
    }
}
