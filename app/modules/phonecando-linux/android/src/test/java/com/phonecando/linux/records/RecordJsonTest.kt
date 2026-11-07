package com.phonecando.linux.records

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the envs.json / images.json codec.
class RecordJsonTest {
  @Test fun envsRoundTripWithEverySourceKind() {
    assertEquals(Samples.envs, RecordJson.decodeEnvs(RecordJson.encodeEnvs(Samples.envs)))
  }

  @Test fun imagesRoundTrip() {
    assertEquals(Samples.images, RecordJson.decodeImages(RecordJson.encodeImages(Samples.images)))
  }

  @Test fun jsonNullStaysNullNotTheString() {
    val text = """{"images":[{"id":"a","envId":"e","state":"ready","failedStep":null,"error":null,"os":null}]}"""
    val image = RecordJson.decodeImages(text).single()
    assertNull(image.failedStep)
    assertNull(image.error)
    assertNull(image.os)
    assertEquals(emptyList<String>(), image.missingTools)
  }

  @Test fun anUnreadableRecordIsDroppedNotTheFile() {
    val text = """{"envs":[
      {"id":"ok","name":"x","source":{"kind":"android"},"state":"ready"},
      {"id":"bad-state","source":{"kind":"android"},"state":"exploded"},
      {"id":"bad-source","source":{"kind":"vm"},"state":"ready"},
      {"id":"no-tag","source":{"kind":"registry","image":"alpine"},"state":"ready"}
    ]}"""
    assertEquals(listOf("ok"), RecordJson.decodeEnvs(text).map { it.id })
  }

  @Test fun emptyObjectsMeanNoRecords() {
    assertEquals(emptyList<EnvRecord>(), RecordJson.decodeEnvs("{}"))
    assertEquals(emptyList<ImageRecord>(), RecordJson.decodeImages("{}"))
  }
}
