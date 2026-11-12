package com.phonecando.lre.image.support

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.image.setup.Unpacker
import com.phonecando.network.CancelSignal
import com.phonecando.network.ProgressSink
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream

/** A layer that builds a synthetic tree instead of carrying a tar stream. */
class TreeLayer(override val size: Long? = 1000, val build: (File) -> Unit) : BaseLayer {
    override val compression = Compression.NONE

    override fun open(): InputStream = ByteArrayInputStream(ByteArray(0))
}

/** Our test double for the tar extractor: runs each [TreeLayer]'s builder, counting calls. */
class TreeUnpacker : Unpacker {
    var calls = 0

    override fun unpack(layer: BaseLayer, dest: File, sink: ProgressSink, cancel: CancelSignal) {
        calls++
        (layer as TreeLayer).build(dest)
    }
}

fun treeBase(config: ImageConfig? = null, build: (File) -> Unit) = BaseImage(listOf(TreeLayer(build = build)), config)

fun config(vararg env: String) = ImageConfig(env.toList(), null, null, emptyList(), emptyList())
