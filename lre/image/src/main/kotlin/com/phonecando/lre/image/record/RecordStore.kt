package com.phonecando.lre.image.record

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.image.files.TextFiles
import java.io.File

/** Reads and writes `run/image.properties`. */
internal object RecordStore {
    fun file(layout: ImageLayout): File = File(layout.run, "image.properties")

    /** The record, or null when setup never wrote one. */
    fun load(layout: ImageLayout): ImageRecord? = TextFiles.read(file(layout))?.let(RecordCodec::decode)

    fun save(layout: ImageLayout, record: ImageRecord) {
        TextFiles.write(file(layout), RecordCodec.encode(record))
    }
}
