package com.phonecando.lme.store.layout

import com.phonecando.lme.api.LmeException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ModelLayoutTest {
    private val layout = ModelLayout(File("/m"))

    @Test
    fun `paths inside the models dir only`() {
        assertEquals(File("/m/models.json"), layout.registry)
        assertEquals(File("/m/q/q.gguf"), layout.file("q", "q.gguf"))
        assertEquals(File("/m/q/q.gguf.part"), layout.part("q", "q.gguf"))
        assertThrows<LmeException.InvalidName> { layout.dir("..") }
        assertThrows<LmeException.InvalidName> { layout.file("q", "../x") }
        assertThrows<LmeException.InvalidName> { layout.part("q", "x.part") }
    }

    @Test
    fun `plain file names`() {
        for (ok in listOf("m.gguf", "m-00001-of-00002.gguf", "Модель.gguf")) assertTrue(FileNames.isPlain(ok), ok)
        for (bad in listOf("", ".hidden", "a/b", "a\\b", "a\u0000b", "x.part", "é".repeat(128))) assertFalse(FileNames.isPlain(bad), bad)
    }
}
