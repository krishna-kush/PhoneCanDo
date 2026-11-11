package com.phonecando.models.jobs

import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class ResumeListTest {
  @get:Rule
  val tmp = TemporaryFolder()

  @Test
  fun `ids are kept once each, in order, across instances`() {
    val file = File(tmp.root, "state/resume.txt")
    val list = ResumeList(file)
    assertEquals(emptyList<String>(), list.ids())
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
    val blocked = tmp.newFile("not-a-folder")
    val list = ResumeList(File(blocked, "resume.txt"))
    list.add("qwen")
    assertEquals(emptyList<String>(), list.ids())
  }
}
