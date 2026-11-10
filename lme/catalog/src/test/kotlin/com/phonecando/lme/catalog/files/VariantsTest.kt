package com.phonecando.lme.catalog.files

import com.phonecando.lme.catalog.RepoFile
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class VariantsTest {
    private val sha = "b".repeat(64)

    @Test
    fun `files without a sha256 and companions are not offered`() {
        val files = listOf(
            RepoFile("m-Q4_0.gguf", 10, null),
            RepoFile("mmproj-F16.gguf", 10, sha),
            RepoFile("MTP/mtp-m-Q8_0.gguf", 10, sha),
            RepoFile("imatrix.gguf", 10, sha),
            RepoFile("notes.txt", 10, sha),
            RepoFile("M-Q8_0.GGUF", 10, sha),
        )
        assertEquals(listOf("M-Q8_0.GGUF"), Variants.of(files).map { it.entry.path })
    }

    @Test
    fun `parts group by folder, stem and count`() {
        val files = listOf(
            RepoFile("a/m-Q4_K_M-00002-of-00002.gguf", 7, sha),
            RepoFile("a/m-Q4_K_M-00001-of-00002.gguf", 3, sha),
            RepoFile("b/m-Q4_K_M-00001-of-00002.gguf", 3, sha),
            RepoFile("m-Q8_0-00001-of-00002.gguf", 1, sha),
            RepoFile("m-Q8_0-00002-of-00003.gguf", 1, sha),
        )
        val variants = Variants.of(files)
        assertEquals(1, variants.size)
        assertEquals(listOf("a/m-Q4_K_M-00001-of-00002.gguf", "a/m-Q4_K_M-00002-of-00002.gguf"), variants[0].files.map { it.path })
        assertEquals(10, variants[0].sizeBytes)
    }
}
