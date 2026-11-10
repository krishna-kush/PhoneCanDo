package com.phonecando.lme.gguf.real

import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.gguf.read.GgufReader
import com.phonecando.lme.gguf.shape.ModelShapes
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Reads real model files, off by default: set LME_GGUF_DIR to a dir of
 * `.gguf` files (ours: ~/.cache/phonecando-spike/models). Every file must
 * read; the ones we know are checked value by value.
 */
class RealFilesTest {
    private val dir = System.getenv("LME_GGUF_DIR")?.takeIf { it.isNotBlank() }?.let(::File)

    @Test
    fun `real files read and the known ones match`() {
        assumeTrue(dir != null, "LME_GGUF_DIR is not set")
        val files = dir!!.listFiles { f -> f.isFile && f.name.endsWith(".gguf") }.orEmpty().sortedBy { it.name }
        assertTrue(files.isNotEmpty(), "no .gguf files in $dir")
        for (file in files) {
            val header = file.inputStream().use { GgufReader.read(it) }
            val shape = ModelShapes.of(header)
            println("${file.name}: $shape, header ${header.headerBytes} bytes")
            KNOWN[file.name]?.let { (parameters, kv) ->
                assertEquals("qwen35", shape.architecture)
                assertEquals("Q4_K_M", shape.quant)
                assertEquals(parameters, shape.parameterCount, file.name)
                assertEquals(kv, shape.kvCache, file.name)
            }
        }
    }

    companion object {
        private val KNOWN = mapOf(
            "Qwen3.5-4B-Q4_K_M.gguf" to (4_205_751_296L to KvCacheShape(16384, 0, null)),
            "Qwen3.5-0.8B-Q4_K_M.gguf" to (752_393_024L to KvCacheShape(6144, 0, null)),
        )
    }
}
