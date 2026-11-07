package com.phonecando.linux.images

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.Progress
import com.phonecando.lre.api.ProgressSink
import com.phonecando.lre.image.setup.TarUnpacker
import com.phonecando.lre.image.setup.Unpacker
import java.io.File

/**
 * Unpacks with [inner] and turns its per-layer byte counts into one count
 * over the whole [base]: done is the bytes of every layer before this one
 * plus this one's, total the sum of the layer sizes (null when one is
 * unknown). Pure.
 */
class LayerProgressUnpacker(
  private val base: BaseImage,
  private val inner: Unpacker = TarUnpacker(),
) : Unpacker {
  private val total: Long? = if (base.layers.all { it.size != null }) base.layers.sumOf { it.size!! } else null

  override fun unpack(layer: BaseLayer, dest: File, sink: ProgressSink, cancel: CancelSignal) {
    val index = base.layers.indexOfFirst { it === layer }
    val before = if (index < 0) 0L else base.layers.take(index).sumOf { it.size ?: 0L }
    inner.unpack(layer, dest, { p -> sink.report(Progress(p.step, before + p.done, total)) }, cancel)
  }
}
