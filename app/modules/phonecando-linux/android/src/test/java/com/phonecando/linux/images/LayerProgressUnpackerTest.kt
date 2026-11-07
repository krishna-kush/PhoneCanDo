package com.phonecando.linux.images

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.Progress
import com.phonecando.lre.image.setup.Unpacker
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File

// JVM checks for one unpack count over every layer.
class LayerProgressUnpackerTest {
  private class Layer(override val size: Long?) : BaseLayer {
    override val compression = Compression.GZIP

    override fun open() = ByteArrayInputStream(ByteArray(0))
  }

  // Reports half, then all of each layer, as the tar extractor does.
  private val fake = Unpacker { layer, _, sink, _ ->
    val size = layer.size ?: 0
    sink.report(Progress("unpack", size / 2, null))
    sink.report(Progress("unpack", size, null))
  }

  private fun run(base: BaseImage): List<Progress> {
    val seen = ArrayList<Progress>()
    val unpacker = LayerProgressUnpacker(base, fake)
    base.layers.forEach { unpacker.unpack(it, File("."), { seen += it }, CancelSignal.NEVER) }
    return seen
  }

  @Test fun countsRunOnAcrossLayersAgainstTheWholeSize() {
    val seen = run(BaseImage(listOf(Layer(100), Layer(50)), null))
    assertEquals(listOf(50L, 100L, 125L, 150L), seen.map { it.done })
    seen.forEach { assertEquals(150L, it.total) }
  }

  @Test fun anUnknownLayerSizeMeansNoTotal() {
    val seen = run(BaseImage(listOf(Layer(100), Layer(null)), null))
    seen.forEach { assertEquals(null, it.total) }
  }
}
