package com.phonecando.lme.store.registry

import com.phonecando.lme.store.download.PendingDownload
import com.phonecando.lme.store.download.RemoteFile
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ModelRegistryTest {
    @TempDir
    lateinit var dir: File

    @Test
    fun `missing is empty, a no-op writes nothing, a change is written whole`() {
        val file = File(dir, "models/models.json")
        val registry = ModelRegistry(file)
        assertEquals(Registry.EMPTY, registry.read())
        registry.update { it }
        assertFalse(file.exists())

        val pending = PendingDownload("m", "M", "a/b", "c".repeat(40), listOf(RemoteFile("m.gguf", "https://x", 1, "d".repeat(64))), 5)
        registry.update { it.withDownload(pending) }
        assertTrue(file.isFile)
        assertEquals(listOf(pending), ModelRegistry(file).read().downloads)
        assertEquals(listOf("models.json"), file.parentFile.list()!!.toList())
    }
}
