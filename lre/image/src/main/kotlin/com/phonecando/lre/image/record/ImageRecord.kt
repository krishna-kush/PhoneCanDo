package com.phonecando.lre.image.record

import com.phonecando.lre.image.detect.Detection

/** What kind of image a layout holds, as setup last recorded it. */
internal sealed interface ImageRecord {
    /** No Linux: the engine runs with HOME and TMPDIR only. */
    data object Android : ImageRecord

    data class Linux(val detection: Detection) : ImageRecord
}
