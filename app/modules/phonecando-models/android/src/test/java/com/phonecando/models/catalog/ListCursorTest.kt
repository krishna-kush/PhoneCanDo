package com.phonecando.models.catalog

import com.phonecando.lme.catalog.filters.ModelSize
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ListCursorTest {
  private val link = "https://huggingface.co/api/models?filter=gguf&sort=downloads&direction=-1&limit=100&cursor=eyJ9"

  @Test
  fun `a cursor keeps the Hub's link and the size beside it`() {
    for (size in ModelSize.entries + null) {
      val cursor = ListCursor(link, size)
      assertEquals(cursor, ListCursor.parse(cursor.encode()))
    }
    assertEquals("any $link", ListCursor(link, null).encode())
    assertEquals("UP_TO_2B $link", ListCursor(link, ModelSize.UP_TO_2B).encode())
  }

  @Test
  fun `anything else is refused`() {
    for (text in listOf(link, "", " ", "any", "any ", "tiny $link", " $link")) {
      assertThrows(IllegalArgumentException::class.java) { ListCursor.parse(text) }
    }
  }
}
