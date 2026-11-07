package com.phonecando.lre.image.setup

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.ProgressSink
import java.io.File

/** Applies one base layer to a rootfs dir; [TarUnpacker] is the real one. */
fun interface Unpacker {
    fun unpack(layer: BaseLayer, dest: File, sink: ProgressSink, cancel: CancelSignal)
}

/** Every layer of [base] into [dest], in order, checking [cancel] between layers. */
internal fun Unpacker.unpackAll(base: BaseImage, dest: File, sink: ProgressSink, cancel: CancelSignal) {
    for (layer in base.layers) {
        if (cancel.isCancelled()) throw LreException.Cancelled()
        unpack(layer, dest, sink, cancel)
    }
}
