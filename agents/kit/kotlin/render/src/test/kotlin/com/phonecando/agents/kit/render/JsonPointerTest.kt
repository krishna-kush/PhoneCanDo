package com.phonecando.agents.kit.render

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class JsonPointerTest {
  private val doc = Json.parseToJsonElement("""{"data":{"title":"T","n":3,"z":null,"a/b":{"~k":"esc"},"list":["x","y"]}}""")

  @Test fun resolves() {
    assertEquals(doc, JsonPointer.resolve(doc, ""))
    assertEquals(JsonPrimitive("T"), JsonPointer.resolve(doc, "/data/title"))
    assertEquals(JsonPrimitive("esc"), JsonPointer.resolve(doc, "/data/a~1b/~0k"))
    assertEquals(JsonPrimitive("y"), JsonPointer.resolve(doc, "/data/list/1"))
    assertNull(JsonPointer.resolve(doc, "/data/list/2"))
    assertNull(JsonPointer.resolve(doc, "/data/list/-1"))
    assertNull(JsonPointer.resolve(doc, "/data/title/x"))
    assertNull(JsonPointer.resolve(doc, "/nope"))
    assertNull(JsonPointer.resolve(doc, "data"))
  }

  @Test fun textOfAScalar() {
    val body = doc.toString()
    assertEquals("T", JsonPointer.text(body, "/data/title"))
    assertEquals("3", JsonPointer.text(body, "/data/n"))
    assertNull(JsonPointer.text(body, "/data/z"))
    assertNull(JsonPointer.text(body, "/data/list"))
    assertNull(JsonPointer.text(body, "/data"))
    assertNull(JsonPointer.text("not json", "/data"))
    assertNull(JsonPointer.text("", "/data"))
  }
}
