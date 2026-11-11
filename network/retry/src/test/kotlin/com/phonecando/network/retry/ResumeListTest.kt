package com.phonecando.network.retry

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals

class ResumeListTest {
    @TempDir
    lateinit var dir: File

    @Test
    fun `ids are kept once each, in order, across instances`() {
        val file = File(dir, "state/resume.txt")
        val list = ResumeList(file)
        assertEquals(emptyList(), list.ids())
        list.add("qwen")
        list.add("gemma")
        list.add("qwen")
        assertEquals(listOf("qwen", "gemma"), ResumeList(file).ids())
        list.remove("qwen")
        list.remove("nope")
        assertEquals(listOf("gemma"), ResumeList(file).ids())
    }

    @Test
    fun `a list we cannot write only means nothing resumes`() {
        val blocked = File(dir, "not-a-folder").apply { writeText("x") }
        val list = ResumeList(File(blocked, "resume.txt"))
        list.add("qwen")
        assertEquals(emptyList(), list.ids())
    }
}
