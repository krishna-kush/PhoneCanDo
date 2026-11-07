package com.phonecando.lre.oci.blob

import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.api.Compression
import java.io.BufferedInputStream
import java.io.File
import java.io.InputStream

/** A downloaded, verified layer blob on disk. */
internal class FileLayer(
    private val file: File,
    override val compression: Compression,
    override val size: Long?,
) : BaseLayer {
    override fun open(): InputStream = BufferedInputStream(file.inputStream(), 64 * 1024)
}
