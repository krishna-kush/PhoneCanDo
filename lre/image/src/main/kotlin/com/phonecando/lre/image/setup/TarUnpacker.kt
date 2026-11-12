package com.phonecando.lre.image.setup

import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.tar.TarExtractor
import com.phonecando.network.CancelSignal
import com.phonecando.network.ProgressSink
import java.io.File

/** Unpacks a layer with our tar extractor; progress is bytes read, step `unpack`. */
class TarUnpacker(private val extractor: TarExtractor = TarExtractor()) : Unpacker {
    override fun unpack(layer: BaseLayer, dest: File, sink: ProgressSink, cancel: CancelSignal) {
        layer.open().use { extractor.extract(it, layer.compression, dest, sink, cancel) }
    }
}
